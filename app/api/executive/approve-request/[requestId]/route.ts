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
          status: 'APPROVED',
          comments: comment || null,
          approvedAt: new Date()
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
