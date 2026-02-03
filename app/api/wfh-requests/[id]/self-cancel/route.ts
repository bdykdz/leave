import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification-service';

// POST: Cancel own WFH request (employee self-cancellation)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request ID parameter
    if (!params.id || typeof params.id !== 'string' || params.id.trim() === '') {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    // Safely parse JSON body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body?.reason;
    } catch (jsonError) {
      // JSON parsing failed, but reason is optional so continue
      reason = undefined;
    }

    // Fetch the WFH request
    const wfhRequest = await prisma.workFromHomeRequest.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        approvals: true
      }
    });

    if (!wfhRequest) {
      return NextResponse.json({ error: 'WFH request not found' }, { status: 404 });
    }

    // Check if the request belongs to the current user
    if (wfhRequest.userId !== session.user.id) {
      return NextResponse.json({ error: 'You can only cancel your own requests' }, { status: 403 });
    }

    // Check if request can be cancelled by employee
    if (wfhRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Request is already cancelled' }, { status: 400 });
    }

    if (wfhRequest.status === 'REJECTED') {
      return NextResponse.json({ error: 'Cannot cancel a rejected request' }, { status: 400 });
    }

    if (wfhRequest.status === 'APPROVED') {
      // Check if the WFH has already started
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (wfhRequest.startDate <= today) {
        return NextResponse.json({ 
          error: 'Cannot cancel an approved request that has already started' 
        }, { status: 400 });
      }
    }

    // Only allow cancellation of PENDING or future APPROVED requests
    if (!['PENDING', 'APPROVED'].includes(wfhRequest.status)) {
      return NextResponse.json({ error: 'Request cannot be cancelled' }, { status: 400 });
    }

    // Perform all database operations in a transaction for data consistency
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Cancel the request
      const cancelledRequest = await tx.workFromHomeRequest.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED'
        }
      });

      // Cancel all pending approvals for this request
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

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'SELF_CANCEL_REQUEST',
          entity: 'WFH_REQUEST',
          entityId: params.id,
          oldValues: { status: wfhRequest.status },
          newValues: { status: 'CANCELLED', reason: reason || `Cancelled by ${session.user.email}` }
        }
      });

      return cancelledRequest;
    });

    // Send notification to managers/HR about the cancellation
    try {
      const managers = await prisma.user.findMany({
        where: {
          OR: [
            { id: wfhRequest.user.managerId },
            { id: wfhRequest.user.departmentDirectorId },
            { role: 'HR' }
          ]
        },
        select: { id: true }
      });

      const managerIds = managers.map(m => m.id).filter(Boolean);
      
      if (managerIds.length > 0) {
        // Notify the employee about their own cancellation
        await NotificationService.createNotification({
          userId: session.user.id,
          type: 'REQUEST_CANCELLED',
          title: 'WFH Request Cancelled',
          message: `Your work from home request for ${wfhRequest.startDate.toDateString()} - ${wfhRequest.endDate.toDateString()} has been cancelled`,
          link: `/employee?request=${params.id}`
        });

        // Notify managers and HR about the cancellation
        for (const managerId of managerIds) {
          if (managerId !== session.user.id) {
            // Check if the manager is an HR employee to determine correct link
            const managerUser = await prisma.user.findUnique({
              where: { id: managerId },
              select: { role: true, department: true }
            });
            
            let notificationLink = `/manager?request=${params.id}`;
            if (managerUser) {
              if (managerUser.role === 'HR' || 
                  (managerUser.role === 'EMPLOYEE' && managerUser.department?.toLowerCase().includes('hr'))) {
                notificationLink = `/hr?request=${params.id}`;
              } else if (managerUser.role === 'EXECUTIVE') {
                notificationLink = `/executive?request=${params.id}`;
              }
            }
            
            await NotificationService.createNotification({
              userId: managerId,
              type: 'REQUEST_CANCELLED',
              title: 'WFH Request Cancelled',
              message: `${wfhRequest.user.firstName} ${wfhRequest.user.lastName} has cancelled their work from home request for ${wfhRequest.startDate.toDateString()} - ${wfhRequest.endDate.toDateString()}`,
              link: notificationLink
            });
          }
        }
      }
    } catch (notificationError) {
      // Don't fail the whole operation if notifications fail
      console.error('Error sending cancellation notifications:', notificationError);
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