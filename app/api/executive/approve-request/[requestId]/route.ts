import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { SmartDocumentGenerator } from '@/lib/smart-document-generator';
import { emailService } from '@/lib/email-service';
import { format } from 'date-fns';
import { sanitizeComment } from '@/lib/utils/sanitize';

export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'EXECUTIVE' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const rawComment = body.comment || '';

    // Prefer signature as a separate field (new pattern)
    let signature: string | null = body.signature || null;

    // Backward compat: extract from comment if clients still embed [SIGNATURE:...] (deprecated)
    let commentForSanitize = rawComment;
    if (!signature && rawComment.includes('[SIGNATURE:')) {
      const signatureMatch = rawComment.match(/\[SIGNATURE:(data:image\/[^\]]+)\]/);
      if (signatureMatch) {
        signature = signatureMatch[1];
        commentForSanitize = rawComment.replace(/\[SIGNATURE:data:image\/[^\]]+\]/, '');
        console.warn('[DEPRECATED] Signature embedded in comment — clients should send body.signature instead');
      }
    }

    // Validate signature size (max 50KB)
    if (signature && signature.length > 50000) {
      return NextResponse.json(
        { error: 'Signature data exceeds maximum allowed size' },
        { status: 400 }
      );
    }

    let comment = sanitizeComment(commentForSanitize);

    // Verify the request exists and get details
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        approvals: { select: { id: true, approverId: true, status: true, level: true } }
      }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Fix #5: Reject if request is not PENDING
    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request is not in pending status' },
        { status: 400 }
      );
    }

    // Prevent circular approval: executive cannot approve their own request
    if (leaveRequest.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot approve your own leave request' },
        { status: 403 }
      );
    }

    // Check if this executive is assigned as an approver OR is an admin
    const isAssignedApprover = leaveRequest.approvals.some(
      approval => approval.approverId === session.user.id && approval.status === 'PENDING'
    );

    if (!isAssignedApprover && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You are not assigned to approve this request' },
        { status: 403 }
      );
    }

    // Sequential approval order check: all lower-level approvals must be APPROVED first
    // (e.g., HR verification at level 1 must complete before executive can approve at level 2)
    if (isAssignedApprover) {
      const executiveApproval = leaveRequest.approvals.find(
        a => a.approverId === session.user.id && a.status === 'PENDING'
      );
      if (executiveApproval) {
        const lowerLevelApprovals = leaveRequest.approvals.filter(
          a => a.level < executiveApproval.level && a.id !== executiveApproval.id
        );
        const hasUnapprovedPrior = lowerLevelApprovals.some(a => a.status !== 'APPROVED');
        if (hasUnapprovedPrior) {
          return NextResponse.json(
            { error: 'Previous approval levels must be completed first' },
            { status: 400 }
          );
        }
      }
    }

    // Fix #3: Move updateMany + findMany inside the transaction to prevent race conditions
    const { updatedRequest, allApproved } = await prisma.$transaction(async (tx) => {
      // Fix #8: ADMIN override — create an approval record if ADMIN has no assigned record
      if (session.user.role === 'ADMIN' && !isAssignedApprover) {
        await tx.approval.create({
          data: {
            leaveRequestId: params.requestId,
            approverId: session.user.id,
            level: 0, // ADMIN override level
            status: 'APPROVED',
            comments: comment ? `[ADMIN OVERRIDE] ${comment}` : '[ADMIN OVERRIDE]',
            signature: signature,
            approvedAt: new Date(),
            signedAt: signature ? new Date() : null,
          }
        });
      } else {
        // Update the existing approval record for this executive
        await tx.approval.updateMany({
          where: {
            leaveRequestId: params.requestId,
            approverId: session.user.id,
            status: 'PENDING'
          },
          data: {
            status: 'APPROVED',
            comments: comment || null,
            signature: signature,
            approvedAt: new Date(),
            signedAt: signature ? new Date() : null
          }
        });
      }

      // Check if all approvals are complete (inside transaction)
      const allApprovals = await tx.approval.findMany({
        where: { leaveRequestId: params.requestId }
      });

      let isAllApproved = allApprovals.every(approval => approval.status === 'APPROVED');

      // Clean up escalation fallback approvals from old workflow (pre-9ec7382).
      // Old workflow created all levels upfront; new workflow creates only level 1.
      // Remaining PENDING levels above the current one are escalation fallbacks.
      // Exception: HR-verification types need sequential approval (HR → manager).
      if (!isAllApproved && isAssignedApprover) {
        const executiveApprovalLevel = leaveRequest.approvals.find(
          (a: any) => a.approverId === session.user.id
        )?.level ?? 0;
        const leaveTypeForCheck = await tx.leaveRequest.findUnique({
          where: { id: params.requestId },
          select: { leaveType: { select: { requiresHRVerification: true } } }
        });
        if (!leaveTypeForCheck?.leaveType?.requiresHRVerification) {
          const remainingPending = allApprovals.filter(
            (a: any) => a.status === 'PENDING' && a.level > executiveApprovalLevel
          );
          if (remainingPending.length > 0) {
            console.log('[executive-approve] Cleaning up escalation fallback approvals:',
              remainingPending.map((a: any) => ({ id: a.id, level: a.level, approverId: a.approverId }))
            );
            await tx.approval.deleteMany({
              where: { id: { in: remainingPending.map((a: any) => a.id) } }
            });
            isAllApproved = true;
          }
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: isAllApproved ? 'APPROVED' : 'PENDING'
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          leaveType: true
        }
      });

      // If fully approved, update leave balance with FIFO carry-forward deduction
      // Use request's start date year — balance was deducted in that year at submission time
      if (isAllApproved && updated.leaveTypeId && updated.totalDays > 0) {
        const balanceYear = new Date(updated.startDate).getFullYear();
        try {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              userId_leaveTypeId_year: {
                userId: updated.userId,
                leaveTypeId: updated.leaveTypeId,
                year: balanceYear
              }
            }
          });
          if (!balance) {
            throw new Error(`No leave balance record found for user ${updated.userId}, leaveType ${updated.leaveTypeId}, year ${balanceYear}. Cannot approve without a balance record.`);
          }
          const totalDays = updated.totalDays;
          const remainingCF = Math.max(0, balance.carriedForward - balance.carriedForwardUsed);
          const cfDeduction = Math.min(totalDays, remainingCF);
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: balance.pending - totalDays,
              used: balance.used + totalDays,
              carriedForwardUsed: balance.carriedForwardUsed + cfDeduction,
              available: balance.entitled + balance.carriedForward - (balance.used + totalDays) - (balance.pending - totalDays)
            }
          });
        } catch (balanceError) {
          console.error('Failed to update leave balance:', balanceError);
          throw balanceError; // Abort transaction — balance must stay consistent with request status
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'REQUEST_APPROVED',
          entity: 'LEAVE_REQUEST',
          entityId: params.requestId,
          oldValues: { status: 'PENDING' },
          newValues: { status: isAllApproved ? 'APPROVED' : 'PENDING', comment: comment || null }
        }
      });

      return { updatedRequest: updated, allApproved: isAllApproved };
    });

    // Notify the next approver in the chain if not fully approved yet
    if (!allApproved) {
      try {
        const allApprovals = await prisma.approval.findMany({
          where: { leaveRequestId: params.requestId },
          orderBy: { level: 'asc' },
        });
        const nextPending = allApprovals.find(a => a.status === 'PENDING');
        if (nextPending?.approverId) {
          await prisma.notification.create({
            data: {
              userId: nextPending.approverId,
              type: 'APPROVAL_REQUIRED',
              title: 'Leave Request Pending Your Approval',
              message: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}'s leave request has been approved at the previous level and now requires your approval.`,
              link: `/leave-requests/${params.requestId}`,
            },
          });
        }
      } catch (notifError) {
        console.error('Warning: Failed to notify next approver:', notifError);
      }
    }

    // Fix #15: Wrap notification creation in try-catch — don't mask success as failure
    try {
      await prisma.notification.create({
        data: {
          userId: updatedRequest.userId,
          type: 'LEAVE_APPROVED',
          title: 'Leave Request Approved',
          message: `Your ${updatedRequest.leaveType.name} request has been approved by executive management.`,
          link: `/employee?tab=requests`
        }
      });
    } catch (notifError) {
      console.error('Warning: Failed to create approval notification:', notifError);
    }

    // Add executive signature to document immediately (before checking allApproved)
    try {
      const existingDoc = await prisma.generatedDocument.findUnique({
        where: { leaveRequestId: params.requestId }
      });

      if (existingDoc) {
        const generator = new SmartDocumentGenerator();
        await generator.addSignature(
          existingDoc.id,
          session.user.id,
          'executive',
          signature || `APPROVED_BY_EXECUTIVE`
        );
        console.log('Executive signature added to document:', existingDoc.id);
      } else {
        // Generate document if it doesn't exist
        const leaveType = await prisma.leaveType.findUnique({
          where: { id: updatedRequest.leaveTypeId },
          include: {
            documentTemplates: {
              where: { isActive: true },
              orderBy: { version: 'desc' },
              take: 1
            }
          }
        });

        if (leaveType?.documentTemplates && leaveType.documentTemplates.length > 0) {
          const generator = new SmartDocumentGenerator();
          const template = leaveType.documentTemplates[0];
          const documentId = await generator.generateDocument(params.requestId, template.id);

          if (documentId) {
            await generator.addSignature(
              documentId,
              session.user.id,
              'executive',
              signature || `APPROVED_BY_EXECUTIVE`
            );
          }
          console.log('Document generated by executive approval:', documentId);
        }
      }
    } catch (docError) {
      console.error('Error handling document during executive approval:', docError);
    }

    // When fully approved, regenerate document with all signatures and send email
    if (allApproved) {
      // Regenerate document to include all signatures
      try {
        const doc = await prisma.generatedDocument.findUnique({
          where: { leaveRequestId: params.requestId },
          include: { template: true }
        });
        if (doc?.template) {
          const generator = new SmartDocumentGenerator();
          await generator.generateDocument(params.requestId, doc.template.id);
          console.log('Document regenerated with all signatures');
        }
      } catch (docError) {
        console.error('Error regenerating document:', docError);
      }

      // Send approval email notification
      try {
        if (updatedRequest.user?.email) {
          await emailService.sendApprovalNotification(updatedRequest.user.email, {
            employeeName: `${updatedRequest.user.firstName} ${updatedRequest.user.lastName}`,
            leaveType: updatedRequest.leaveType.name,
            startDate: format(updatedRequest.startDate, 'dd MMMM yyyy'),
            endDate: format(updatedRequest.endDate, 'dd MMMM yyyy'),
            days: updatedRequest.totalDays,
            approverName: `${session.user.firstName} ${session.user.lastName}`,
            status: 'approved',
            comments: comment || undefined,
            companyName: process.env.COMPANY_NAME || 'TPF',
            requestId: params.requestId
          });
        }
      } catch (emailError) {
        console.error('Error sending executive approval email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Request approved successfully',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Error approving request:', error);
    return NextResponse.json(
      { error: 'Failed to approve request' },
      { status: 500 }
    );
  }
}
