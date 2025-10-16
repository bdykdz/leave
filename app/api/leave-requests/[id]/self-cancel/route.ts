import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification-service';
import { updateLeaveBalanceOnRejection } from '@/lib/leave-balance';

// POST: Cancel own leave request (employee self-cancellation)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Check if the request belongs to the current user
    if (leaveRequest.userId !== session.user.id) {
      return NextResponse.json({ error: 'You can only cancel your own requests' }, { status: 403 });
    }

    // Check if request can be cancelled by employee
    if (leaveRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Request is already cancelled' }, { status: 400 });
    }

    if (leaveRequest.status === 'REJECTED') {
      return NextResponse.json({ error: 'Cannot cancel a rejected request' }, { status: 400 });
    }

    if (leaveRequest.status === 'APPROVED') {
      // Check if the leave has already started
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (leaveRequest.startDate <= today) {
        return NextResponse.json({ 
          error: 'Cannot cancel an approved request that has already started' 
        }, { status: 400 });
      }
    }

    // Only allow cancellation of PENDING or future APPROVED requests
    if (!['PENDING', 'APPROVED'].includes(leaveRequest.status)) {
      return NextResponse.json({ error: 'Request cannot be cancelled' }, { status: 400 });
    }

    // Cancel the request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED'
      }
    });

    // Restore leave balance based on request status
    if (leaveRequest.leaveTypeId && leaveRequest.leaveType) {
      const currentYear = new Date().getFullYear();
      
      if (leaveRequest.status === 'APPROVED') {
        // For approved requests, we need to reverse the approval (remove from used, add back to available)
        const existingBalance = await prisma.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: leaveRequest.userId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year: currentYear
            }
          }
        });

        if (existingBalance && leaveRequest.leaveType.code === 'NL') {
          const newUsed = Math.max(0, existingBalance.used - leaveRequest.totalDays);
          const newAvailable = existingBalance.entitled - newUsed - existingBalance.pending;
          
          await prisma.leaveBalance.update({
            where: { id: existingBalance.id },
            data: {
              used: newUsed,
              available: newAvailable
            }
          });
        }
      } else if (leaveRequest.status === 'PENDING') {
        // For pending requests, use the existing rejection logic (remove from pending)
        await updateLeaveBalanceOnRejection(
          leaveRequest.userId,
          leaveRequest.leaveTypeId,
          leaveRequest.leaveType.code,
          leaveRequest.totalDays,
          currentYear
        );
      }
    }

    // Cancel all pending approvals for this request
    await prisma.approval.updateMany({
      where: {
        leaveRequestId: params.id,
        status: 'PENDING'
      },
      data: {
        status: 'REJECTED',
        comments: `Request cancelled by ${session.user.role.toLowerCase()}`,
        approvedAt: new Date()
      }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SELF_CANCEL_REQUEST',
        entity: 'LEAVE_REQUEST',
        entityId: params.id,
        oldValues: { status: leaveRequest.status },
        newValues: { status: 'CANCELLED', reason: reason || `Cancelled by ${session.user.role.toLowerCase()}` }
      }
    });

    // Send notification to managers/HR about the cancellation
    try {
      const managers = await prisma.user.findMany({
        where: {
          OR: [
            { id: leaveRequest.user.managerId },
            { id: leaveRequest.user.departmentDirectorId },
            { role: 'HR' }
          ]
        },
        select: { id: true }
      });

      const managerIds = managers.map(m => m.id).filter(Boolean);
      
      if (managerIds.length > 0) {
        // Notify the employee about their own cancellation
        await NotificationService.notifyLeaveCancelled(
          session.user.id,
          leaveRequest.leaveType?.name || 'Leave',
          `${leaveRequest.startDate.toDateString()} - ${leaveRequest.endDate.toDateString()}`,
          leaveRequest.requestNumber,
          params.id
        );

        // Notify managers and HR about the cancellation
        for (const managerId of managerIds) {
          if (managerId !== session.user.id) {
            await NotificationService.createNotification({
              userId: managerId,
              type: 'LEAVE_CANCELLED',
              title: 'Leave Request Cancelled',
              message: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName} has cancelled their ${leaveRequest.leaveType?.name || 'leave'} request for ${leaveRequest.startDate.toDateString()} - ${leaveRequest.endDate.toDateString()}`,
              link: `/manager?request=${params.id}`
            });
          }
        }
      }
    } catch (notificationError) {
      // Don't fail the whole operation if notifications fail
      console.error('Error sending cancellation notifications:', notificationError);
    }

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