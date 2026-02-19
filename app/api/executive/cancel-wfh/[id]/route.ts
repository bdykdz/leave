import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification-service';
import { emailService } from '@/lib/email-service';

// POST: Cancel an approved WFH request (executive override)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (!params.id || typeof params.id !== 'string' || params.id.trim() === '') {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    // Safely parse JSON body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : undefined;
    } catch {
      reason = undefined;
    }

    // Fetch the WFH request with user
    const wfhRequest = await prisma.workFromHomeRequest.findUnique({
      where: { id: params.id },
      include: {
        user: true
      }
    });

    if (!wfhRequest) {
      return NextResponse.json({ error: 'WFH request not found' }, { status: 404 });
    }

    // Status guard: must be APPROVED
    if (wfhRequest.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved WFH requests can be cancelled' },
        { status: 400 }
      );
    }

    // Future guard: cannot cancel WFH that has already started
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (wfhRequest.startDate <= today) {
      return NextResponse.json(
        { error: 'Cannot cancel WFH request that has already started' },
        { status: 400 }
      );
    }

    // Perform all database operations in a transaction
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction to prevent TOCTOU race condition
      const current = await tx.workFromHomeRequest.findUnique({
        where: { id: params.id },
        select: { status: true }
      });
      if (current?.status !== 'APPROVED') {
        throw new Error('ALREADY_CANCELLED');
      }

      // Cancel the request
      const cancelledRequest = await tx.workFromHomeRequest.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED'
        }
      });

      // No leave balance restoration needed for WFH

      // Reject any pending WFH approvals
      await tx.wFHApproval.updateMany({
        where: {
          wfhRequestId: params.id,
          status: 'PENDING'
        },
        data: {
          status: 'REJECTED',
          comments: `Request cancelled by executive ${session.user.email}`,
          approvedAt: new Date()
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'EXECUTIVE_CANCEL_REQUEST',
          entity: 'WFH_REQUEST',
          entityId: params.id,
          oldValues: { status: wfhRequest.status },
          newValues: {
            status: 'CANCELLED',
            reason: reason || `Cancelled by executive ${session.user.email}`,
            cancelledBy: session.user.email
          }
        }
      });

      return cancelledRequest;
    });

    // Send notifications (fire-and-forget)
    try {
      const employeeName = `${wfhRequest.user.firstName} ${wfhRequest.user.lastName}`;
      const executiveName = session.user.name || session.user.email;
      const dateRange = `${wfhRequest.startDate.toDateString()} - ${wfhRequest.endDate.toDateString()}`;
      const companyName = process.env.COMPANY_NAME || 'TPF';

      // In-app notification to employee
      await NotificationService.createNotification({
        userId: wfhRequest.userId,
        type: 'WFH_CANCELLED',
        title: 'WFH Request Cancelled',
        message: `Your Work From Home request for ${dateRange} has been cancelled by ${executiveName}.${reason ? ` Reason: ${reason}` : ''}`,
        link: '/employee'
      });

      // In-app notification to employee's manager
      if (wfhRequest.user.managerId) {
        await NotificationService.createNotification({
          userId: wfhRequest.user.managerId,
          type: 'WFH_CANCELLED',
          title: 'WFH Request Cancelled',
          message: `${employeeName}'s Work From Home request for ${dateRange} was cancelled by ${executiveName}.`,
          link: '/manager'
        });
      }

      // In-app notification to all HR users
      const hrUsers = await prisma.user.findMany({
        where: { role: 'HR', isActive: true },
        select: { id: true, email: true, firstName: true, lastName: true }
      });

      for (const hrUser of hrUsers) {
        await NotificationService.createNotification({
          userId: hrUser.id,
          type: 'WFH_CANCELLED',
          title: 'WFH Request Cancelled',
          message: `${employeeName}'s Work From Home request for ${dateRange} was cancelled by ${executiveName}.`,
          link: '/hr'
        });
      }

      // Email to employee
      if (wfhRequest.user.email) {
        emailService.sendCancellationNotification(wfhRequest.user.email, {
          employeeName,
          leaveType: 'Work From Home',
          startDate: wfhRequest.startDate.toDateString(),
          endDate: wfhRequest.endDate.toDateString(),
          totalDays: wfhRequest.totalDays,
          cancelledBy: executiveName,
          reason,
          recipientType: 'employee',
          recipientName: wfhRequest.user.firstName,
          companyName
        });
      }

      // Email to manager
      if (wfhRequest.user.managerId) {
        const manager = await prisma.user.findUnique({
          where: { id: wfhRequest.user.managerId },
          select: { email: true, firstName: true }
        });
        if (manager?.email) {
          emailService.sendCancellationNotification(manager.email, {
            employeeName,
            leaveType: 'Work From Home',
            startDate: wfhRequest.startDate.toDateString(),
            endDate: wfhRequest.endDate.toDateString(),
            totalDays: wfhRequest.totalDays,
            cancelledBy: executiveName,
            reason,
            recipientType: 'manager',
            recipientName: manager.firstName,
            companyName
          });
        }
      }

      // Email to HR users
      for (const hrUser of hrUsers) {
        if (hrUser.email) {
          emailService.sendCancellationNotification(hrUser.email, {
            employeeName,
            leaveType: 'Work From Home',
            startDate: wfhRequest.startDate.toDateString(),
            endDate: wfhRequest.endDate.toDateString(),
            totalDays: wfhRequest.totalDays,
            cancelledBy: executiveName,
            reason,
            recipientType: 'hr',
            recipientName: hrUser.firstName,
            companyName
          });
        }
      }
    } catch (notificationError) {
      console.error('Error sending cancellation notifications:', notificationError);
    }

    return NextResponse.json({
      message: 'WFH request cancelled successfully',
      requestId: updatedRequest.id
    });
  } catch (error: any) {
    if (error?.message === 'ALREADY_CANCELLED') {
      return NextResponse.json(
        { error: 'Request was already cancelled or status changed' },
        { status: 409 }
      );
    }
    console.error('Error cancelling WFH request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel WFH request' },
      { status: 500 }
    );
  }
}
