import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification-service';

// POST: Cancel own work trip request (employee self-cancellation)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!params.id || typeof params.id !== 'string' || params.id.trim() === '') {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body?.reason;
    } catch {
      reason = undefined;
    }

    const workTripRequest = await prisma.workTripRequest.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        approvals: true
      }
    });

    if (!workTripRequest) {
      return NextResponse.json({ error: 'Work trip request not found' }, { status: 404 });
    }

    if (workTripRequest.userId !== session.user.id) {
      return NextResponse.json({ error: 'You can only cancel your own requests' }, { status: 403 });
    }

    if (workTripRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Request is already cancelled' }, { status: 400 });
    }

    if (workTripRequest.status === 'REJECTED') {
      return NextResponse.json({ error: 'Cannot cancel a rejected request' }, { status: 400 });
    }

    if (workTripRequest.status === 'APPROVED') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (workTripRequest.startDate <= today) {
        return NextResponse.json({
          error: 'Cannot cancel an approved request that has already started'
        }, { status: 400 });
      }
    }

    if (!['PENDING', 'APPROVED'].includes(workTripRequest.status)) {
      return NextResponse.json({ error: 'Request cannot be cancelled' }, { status: 400 });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const cancelledRequest = await tx.workTripRequest.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED'
        }
      });

      await tx.workTripApproval.updateMany({
        where: {
          workTripRequestId: params.id,
          status: 'PENDING'
        },
        data: {
          status: 'REJECTED',
          comments: `Request cancelled by ${session.user.email}`,
          approvedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'SELF_CANCEL_REQUEST',
          entity: 'WORK_TRIP_REQUEST',
          entityId: params.id,
          oldValues: { status: workTripRequest.status },
          newValues: { status: 'CANCELLED', reason: reason || `Cancelled by ${session.user.email}` }
        }
      });

      return cancelledRequest;
    });

    // Send notifications
    try {
      const managers = await prisma.user.findMany({
        where: {
          OR: [
            { id: workTripRequest.user.managerId || undefined },
            { id: workTripRequest.user.departmentDirectorId || undefined },
            { role: 'HR' }
          ].filter(c => Object.values(c)[0] !== undefined)
        },
        select: { id: true }
      });

      const managerIds = managers.map(m => m.id).filter(Boolean);

      if (managerIds.length > 0) {
        await NotificationService.createNotification({
          userId: session.user.id,
          type: 'WORK_TRIP_CANCELLED',
          title: 'Work Trip Request Cancelled',
          message: `Your work trip request to ${workTripRequest.destination} for ${workTripRequest.startDate.toDateString()} - ${workTripRequest.endDate.toDateString()} has been cancelled`,
          link: `/employee?request=${params.id}`
        });

        for (const managerId of managerIds) {
          if (managerId !== session.user.id) {
            const managerUser = await prisma.user.findUnique({
              where: { id: managerId },
              select: { role: true, department: true }
            });

            let notificationLink = `/manager?request=${params.id}`;
            if (managerUser) {
              if (managerUser.role === 'HR' ||
                  (managerUser.role === 'EMPLOYEE' && (managerUser.department?.toLowerCase() === 'hr' || managerUser.department?.toLowerCase() === 'human resources'))) {
                notificationLink = `/hr?request=${params.id}`;
              } else if (managerUser.role === 'EXECUTIVE') {
                notificationLink = `/executive?request=${params.id}`;
              }
            }

            await NotificationService.createNotification({
              userId: managerId,
              type: 'WORK_TRIP_CANCELLED',
              title: 'Work Trip Request Cancelled',
              message: `${workTripRequest.user.firstName} ${workTripRequest.user.lastName} has cancelled their work trip request to ${workTripRequest.destination} for ${workTripRequest.startDate.toDateString()} - ${workTripRequest.endDate.toDateString()}`,
              link: notificationLink
            });
          }
        }
      }
    } catch (notificationError) {
      console.error('Error sending cancellation notifications:', notificationError);
    }

    return NextResponse.json({
      message: 'Work trip request cancelled successfully',
      request: updatedRequest
    });

  } catch (error) {
    console.error('Error cancelling work trip request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel work trip request' },
      { status: 500 }
    );
  }
}
