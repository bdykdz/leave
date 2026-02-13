import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { SmartDocumentGenerator } from '@/lib/smart-document-generator';
import { emailService } from '@/lib/email-service';
import { format } from 'date-fns';

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
    let comment = body.comment || '';
    let signature: string | null = null;

    // Extract signature from comment if present
    if (comment && comment.includes('[SIGNATURE:')) {
      const signatureMatch = comment.match(/\[SIGNATURE:(.*?)\]/);
      if (signatureMatch) {
        signature = signatureMatch[1];
        comment = comment.replace(/\[SIGNATURE:.*?\]/, '').trim();
      }
    }

    // Verify the request exists and get details
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: {
        user: true,
        approvals: true
      }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
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

    // For executives with ADMIN role, allow approval even if not explicitly assigned
    // Also allow any executive to approve another executive's request (peer approval)
    const isExecutivePeerApproval = session.user.role === 'EXECUTIVE' &&
      leaveRequest.user.role === 'EXECUTIVE';

    if (!isAssignedApprover && session.user.role !== 'ADMIN' && !isExecutivePeerApproval) {
      return NextResponse.json(
        { error: 'You are not assigned to approve this request' },
        { status: 403 }
      );
    }

    // If this executive is not explicitly assigned but is doing peer approval,
    // create an approval record for them
    if (!isAssignedApprover && isExecutivePeerApproval) {
      await prisma.approval.create({
        data: {
          leaveRequestId: params.requestId,
          approverId: session.user.id,
          level: leaveRequest.approvals.length + 1,
          status: 'APPROVED',
          comments: comment || null,
          signature: signature,
          approvedAt: new Date(),
          signedAt: signature ? new Date() : null
        }
      });
    } else {
      // Update the existing approval record for this executive
      await prisma.approval.updateMany({
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

    // Check if all approvals are complete
    const allApprovals = await prisma.approval.findMany({
      where: { leaveRequestId: params.requestId }
    });

    const allApproved = allApprovals.every(approval => approval.status === 'APPROVED');

    // Update the leave request status if all approvals are complete
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: allApproved ? 'APPROVED' : 'PENDING'
        },
        include: {
          user: true,
          leaveType: true
        }
      });

      // If fully approved, update leave balance
      if (allApproved && updated.leaveTypeId && updated.totalDays > 0) {
        const currentYear = new Date().getFullYear();
        try {
          await tx.leaveBalance.update({
            where: {
              userId_leaveTypeId_year: {
                userId: updated.userId,
                leaveTypeId: updated.leaveTypeId,
                year: currentYear
              }
            },
            data: {
              pending: {
                decrement: updated.totalDays
              },
              used: {
                increment: updated.totalDays
              }
            }
          });
        } catch (balanceError) {
          console.error('Warning: Could not update leave balance:', balanceError);
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
          newValues: { status: allApproved ? 'APPROVED' : 'PENDING', comment: comment || null }
        }
      });

      return updated;
    });

    // Send notification to the employee
    await prisma.notification.create({
      data: {
        userId: updatedRequest.userId,
        type: 'LEAVE_APPROVED',
        title: 'Leave Request Approved',
        message: `Your ${updatedRequest.leaveType.name} request has been approved by executive management.`,
        relatedEntityId: params.requestId,
        relatedEntityType: 'LEAVE_REQUEST'
      }
    });

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
