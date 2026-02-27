import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
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
    // Strip any embedded signature data before sanitizing (denials don't need signatures)
    const rawComment = (body.comment || '').replace(/\[SIGNATURE:data:image\/[^\]]+\]/, '');
    const comment = sanitizeComment(rawComment);

    if (!comment || comment.trim() === '') {
      return NextResponse.json(
        { error: 'Comment is required when denying a request' },
        { status: 400 }
      );
    }

    // Verify the request exists and get details
    const requestDetails = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        approvals: { select: { id: true, approverId: true, status: true, level: true } }
      }
    });

    if (!requestDetails) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Fix #6: Reject if request is not PENDING
    if (requestDetails.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request is not in pending status' },
        { status: 400 }
      );
    }

    // Prevent circular rejection: executive cannot reject their own request
    if (requestDetails.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot reject your own leave request' },
        { status: 403 }
      );
    }

    // Check if this executive is assigned as an approver OR is an admin
    const isAssignedApprover = requestDetails.approvals.some(
      approval => approval.approverId === session.user.id && approval.status === 'PENDING'
    );

    if (!isAssignedApprover && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You are not authorized to reject this request' },
        { status: 403 }
      );
    }

    // Sequential approval order check: all lower-level approvals must be APPROVED first
    if (isAssignedApprover) {
      const executiveApproval = requestDetails.approvals.find(
        a => a.approverId === session.user.id && a.status === 'PENDING'
      );
      if (executiveApproval) {
        const lowerLevelApprovals = requestDetails.approvals.filter(
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

    // Fix #4: Move updateMany inside the transaction to prevent race conditions
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Fix #8: ADMIN override — create a rejection record if ADMIN has no assigned record
      if (session.user.role === 'ADMIN' && !isAssignedApprover) {
        await tx.approval.create({
          data: {
            leaveRequestId: params.requestId,
            approverId: session.user.id,
            level: 0, // ADMIN override level
            status: 'REJECTED',
            comments: `[ADMIN OVERRIDE] ${comment}`,
            approvedAt: new Date(),
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
            status: 'REJECTED',
            comments: comment,
            approvedAt: new Date()
          }
        });
      }

      // Get the leave request to check its current status for balance restoration
      const leaveRequest = await tx.leaveRequest.findUnique({
        where: { id: params.requestId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          leaveType: true
        }
      });

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      // Update the leave request status to rejected
      const rejectedRequest = await tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: 'REJECTED'
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          leaveType: true
        }
      });

      // Restore leave balance based on current status
      // Use request's start date year — balance was deducted in that year at submission time
      if (leaveRequest.leaveTypeId && leaveRequest.totalDays > 0) {
        const balanceYear = new Date(leaveRequest.startDate).getFullYear();

        try {
          if (leaveRequest.status === 'APPROVED') {
            // For approved requests, reverse FIFO: restore CF days first
            const balance = await tx.leaveBalance.findUnique({
              where: {
                userId_leaveTypeId_year: {
                  userId: leaveRequest.userId,
                  leaveTypeId: leaveRequest.leaveTypeId,
                  year: balanceYear
                }
              }
            });
            if (balance) {
              const totalDays = leaveRequest.totalDays;
              const cfRestore = Math.min(totalDays, Math.max(0, balance.carriedForwardUsed));
              await tx.leaveBalance.update({
                where: { id: balance.id },
                data: {
                  used: balance.used - totalDays,
                  carriedForwardUsed: balance.carriedForwardUsed - cfRestore,
                  available: balance.entitled + balance.carriedForward - (balance.used - totalDays) - balance.pending
                }
              });
            }
          } else if (leaveRequest.status === 'PENDING') {
            // For pending requests, restore from pending back to available
            await tx.leaveBalance.update({
              where: {
                userId_leaveTypeId_year: {
                  userId: leaveRequest.userId,
                  leaveTypeId: leaveRequest.leaveTypeId,
                  year: balanceYear
                }
              },
              data: {
                pending: {
                  decrement: leaveRequest.totalDays
                },
                available: {
                  increment: leaveRequest.totalDays
                }
              }
            });
          }
        } catch (balanceError) {
          console.error('Failed to restore leave balance:', balanceError);
          throw balanceError; // Abort transaction — balance must stay consistent with request status
        }
      }

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'REQUEST_DENIED',
          entity: 'LEAVE_REQUEST',
          entityId: params.requestId,
          oldValues: { status: leaveRequest.status },
          newValues: { status: 'REJECTED', reason: comment }
        }
      });

      return rejectedRequest;
    });

    // Fix #15: Wrap notification creation in try-catch — don't mask success as failure
    try {
      await prisma.notification.create({
        data: {
          userId: updatedRequest.userId,
          type: 'LEAVE_REJECTED',
          title: 'Leave Request Denied',
          message: `Your ${updatedRequest.leaveType?.name || 'leave'} request has been denied by executive management. Reason: ${comment}`,
          link: `/employee?tab=requests`
        }
      });
    } catch (notifError) {
      console.error('Warning: Failed to create denial notification:', notifError);
    }

    // Send rejection email to employee
    try {
      if (updatedRequest.user?.email) {
        await emailService.sendApprovalNotification(updatedRequest.user.email, {
          employeeName: `${updatedRequest.user.firstName} ${updatedRequest.user.lastName}`,
          leaveType: updatedRequest.leaveType?.name || 'Leave',
          startDate: format(updatedRequest.startDate, 'dd MMMM yyyy'),
          endDate: format(updatedRequest.endDate, 'dd MMMM yyyy'),
          days: updatedRequest.totalDays,
          approverName: `${session.user.firstName} ${session.user.lastName}`,
          status: 'rejected',
          comments: comment || undefined,
          companyName: process.env.COMPANY_NAME || 'TPF',
          requestId: params.requestId
        });
      }
    } catch (emailError) {
      console.error('Error sending executive rejection email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Request denied successfully',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Error denying request:', error);
    return NextResponse.json(
      { error: 'Failed to deny request' },
      { status: 500 }
    );
  }
}
