import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification-service';

// POST: Cancel a WFH request (ADMIN/HR only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or HR
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body?.reason;
    } catch {
      reason = undefined;
    }

    const wfhRequest = await prisma.workFromHomeRequest.findUnique({
      where: { id: params.id },
      include: { user: true }
    });

    if (!wfhRequest) {
      return NextResponse.json({ error: 'WFH request not found' }, { status: 404 });
    }

    // Check if request can be cancelled
    if (wfhRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Request is already cancelled' }, { status: 400 });
    }

    if (wfhRequest.status === 'APPROVED') {
      // If approved and has started, cannot cancel
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (wfhRequest.startDate <= today) {
        return NextResponse.json({ error: 'Cannot cancel an approved request that has already started' }, { status: 400 });
      }
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.workFromHomeRequest.update({
        where: { id: params.id },
        data: { status: 'CANCELLED' }
      });

      // Reject any approvals still pending on the request
      await tx.wFHApproval.updateMany({
        where: {
          wfhRequestId: params.id,
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
          action: 'REQUEST_CANCELLED',
          entity: 'WFH_REQUEST',
          entityType: 'WFH_REQUEST',
          entityId: params.id,
          details: {
            requestId: params.id,
            previousStatus: wfhRequest.status,
            reason: reason || 'Cancelled by administrator',
            cancelledBy: session.user.email
          }
        }
      });

      return cancelled;
    });

    // Notify the employee (non-critical)
    try {
      await NotificationService.createNotification({
        userId: wfhRequest.userId,
        type: 'WFH_CANCELLED',
        title: 'Cerere WFH anulată',
        message: `Cererea dvs. de lucru de acasă (${wfhRequest.startDate.toLocaleDateString('ro-RO')} - ${wfhRequest.endDate.toLocaleDateString('ro-RO')}) a fost anulată de administrator.${reason ? ' Motiv: ' + reason : ''}`,
        link: `/employee?request=${params.id}`
      });
    } catch (notifyError) {
      console.error('Error sending cancellation notification:', notifyError);
    }

    return NextResponse.json({
      message: 'WFH request cancelled successfully',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Error cancelling WFH request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel WFH request' },
      { status: 500 }
    );
  }
}
