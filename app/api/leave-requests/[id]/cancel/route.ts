import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// POST: Cancel a leave request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { reason } = await request.json();

    // Fetch the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        leaveType: true
      }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Check if request can be cancelled
    if (leaveRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Request is already cancelled' }, { status: 400 });
    }

    if (leaveRequest.status === 'APPROVED') {
      // If approved and has started, cannot cancel
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (leaveRequest.startDate <= today) {
        return NextResponse.json({ error: 'Cannot cancel an approved request that has already started' }, { status: 400 });
      }
    }

    // Cancel the request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        approverComments: reason || 'Cancelled by administrator',
        approvedAt: new Date(),
        approverId: session.user.id
      }
    });

    // If the request was approved, restore the leave balance
    if (leaveRequest.status === 'APPROVED' && leaveRequest.leaveTypeId) {
      const leaveBalance = await prisma.leaveBalance.findFirst({
        where: {
          userId: leaveRequest.userId,
          leaveTypeId: leaveRequest.leaveTypeId
        }
      });

      if (leaveBalance) {
        await prisma.leaveBalance.update({
          where: { id: leaveBalance.id },
          data: {
            used: Math.max(0, leaveBalance.used - leaveRequest.totalDays),
            balance: leaveBalance.balance + leaveRequest.totalDays
          }
        });
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REQUEST_CANCELLED',
        entityType: 'LEAVE_REQUEST',
        entityId: params.id,
        details: {
          requestId: params.id,
          previousStatus: leaveRequest.status,
          reason: reason || 'Cancelled by administrator',
          cancelledBy: session.user.email
        }
      }
    });

    return NextResponse.json({ 
      message: 'Leave request cancelled successfully',
      request: updatedRequest 
    });
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel leave request' },
      { status: 500 }
    );
  }
}