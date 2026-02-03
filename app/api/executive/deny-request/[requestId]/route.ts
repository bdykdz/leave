import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

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

    const { comment } = await request.json();

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
        user: true,
        approvals: true
      }
    });

    if (!requestDetails) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Prevent circular rejection: executive cannot reject their own request
    if (requestDetails.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot reject your own leave request' },
        { status: 403 }
      );
    }

    // Check if this executive is assigned as an approver OR has authority to reject
    const isAssignedApprover = requestDetails.approvals.some(
      approval => approval.approverId === session.user.id && approval.status === 'PENDING'
    );

    // Allow any executive to reject another executive's request (peer rejection)
    const isExecutivePeerAction = session.user.role === 'EXECUTIVE' &&
      requestDetails.user.role === 'EXECUTIVE';

    if (!isAssignedApprover && session.user.role !== 'ADMIN' && !isExecutivePeerAction) {
      return NextResponse.json(
        { error: 'You are not authorized to reject this request' },
        { status: 403 }
      );
    }

    // If this executive is not explicitly assigned but is doing peer rejection,
    // create an approval record for them with REJECTED status
    if (!isAssignedApprover && isExecutivePeerAction) {
      await prisma.approval.create({
        data: {
          leaveRequestId: params.requestId,
          approverId: session.user.id,
          level: requestDetails.approvals.length + 1,
          status: 'REJECTED',
          comments: comment,
          approvedAt: new Date()
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
          status: 'REJECTED',
          comments: comment,
          approvedAt: new Date()
        }
      });
    }

    // Update the leave request status to rejected and restore balance
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Get the leave request first to check its current status
      const leaveRequest = await tx.leaveRequest.findUnique({
        where: { id: params.requestId },
        include: {
          user: true,
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
          user: true,
          leaveType: true
        }
      });

      // Restore leave balance based on current status
      if (leaveRequest.leaveTypeId && leaveRequest.totalDays > 0) {
        const currentYear = new Date().getFullYear();
        
        try {
          if (leaveRequest.status === 'APPROVED') {
            // For approved requests, restore from used back to available
            await tx.leaveBalance.update({
              where: {
                userId_leaveTypeId_year: {
                  userId: leaveRequest.userId,
                  leaveTypeId: leaveRequest.leaveTypeId,
                  year: currentYear
                }
              },
              data: {
                used: {
                  decrement: leaveRequest.totalDays
                },
                available: {
                  increment: leaveRequest.totalDays
                }
              }
            });
          } else if (leaveRequest.status === 'PENDING') {
            // For pending requests, restore from pending back to available
            await tx.leaveBalance.update({
              where: {
                userId_leaveTypeId_year: {
                  userId: leaveRequest.userId,
                  leaveTypeId: leaveRequest.leaveTypeId,
                  year: currentYear
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
          console.error('Warning: Could not restore leave balance:', balanceError);
          // Continue with rejection even if balance update fails
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

    // Send notification to the employee
    await prisma.notification.create({
      data: {
        userId: updatedRequest.userId,
        type: 'LEAVE_REJECTED',
        title: 'Leave Request Denied',
        message: `Your ${updatedRequest.leaveType?.name || 'leave'} request has been denied by executive management. Reason: ${comment}`,
        relatedEntityId: params.requestId,
        relatedEntityType: 'LEAVE_REQUEST'
      }
    });

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
