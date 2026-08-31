import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification-service';
import { emailService } from '@/lib/email-service';
import { watermarkCancelledLeaveDocument } from '@/lib/cancellation-watermark';

// POST: Cancel an approved NL leave request (executive override)
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

    // Fetch the leave request with leaveType and user (including managerId)
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

    // Leave type guard: only Normal Leave (NL) can be cancelled by executive
    if (leaveRequest.leaveType?.code !== 'NL') {
      return NextResponse.json(
        { error: 'Cannot cancel this leave type. Only Normal Leave (NL) can be cancelled by executive override.' },
        { status: 403 }
      );
    }

    // Status guard: must be APPROVED
    if (leaveRequest.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved leave requests can be cancelled' },
        { status: 400 }
      );
    }

    // Future guard: cannot cancel leave that has already started
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (leaveRequest.startDate <= today) {
      return NextResponse.json(
        { error: 'Cannot cancel leave that has already started' },
        { status: 400 }
      );
    }

    // Perform all database operations in a transaction
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction to prevent TOCTOU race condition
      const current = await tx.leaveRequest.findUnique({
        where: { id: params.id },
        select: { status: true }
      });
      if (current?.status !== 'APPROVED') {
        throw new Error('ALREADY_CANCELLED');
      }

      // Cancel the request
      const cancelledRequest = await tx.leaveRequest.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED'
        }
      });

      // Restore leave balance: used decrement, available increment
      // No try/catch — transaction must fail atomically if balance can't be restored
      if (leaveRequest.leaveTypeId && leaveRequest.totalDays > 0) {
        const balanceYear = leaveRequest.startDate.getFullYear();

        // Reverse FIFO: restore CF days first
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
      }

      // Reject any pending approvals (unlikely for APPROVED but safe)
      await tx.approval.updateMany({
        where: {
          leaveRequestId: params.id,
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
          entity: 'LEAVE_REQUEST',
          entityId: params.id,
          oldValues: { status: leaveRequest.status },
          newValues: {
            status: 'CANCELLED',
            reason: reason || `Cancelled by executive ${session.user.email}`,
            cancelledBy: session.user.email
          }
        }
      });

      return cancelledRequest;
    });

    // Stamp the generated PDF with the big diagonal "ANULAT" watermark
    // (non-fatal: the document-export sync sweep re-stamps anything missed here)
    try {
      await watermarkCancelledLeaveDocument(params.id);
    } catch (watermarkError) {
      console.error('Failed to watermark cancelled leave document:', watermarkError);
    }

    // Send notifications (fire-and-forget)
    try {
      const employeeName = `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`;
      const executiveName = session.user.name || session.user.email || '';
      const leaveTypeName = leaveRequest.leaveType?.name || 'Normal Leave';
      const dateRange = `${leaveRequest.startDate.toDateString()} - ${leaveRequest.endDate.toDateString()}`;
      const companyName = process.env.COMPANY_NAME || 'TPF';

      // In-app notification to employee
      await NotificationService.createNotification({
        userId: leaveRequest.userId,
        type: 'LEAVE_CANCELLED',
        title: 'Leave Request Cancelled',
        message: `Your ${leaveTypeName} for ${dateRange} has been cancelled by ${executiveName}.${reason ? ` Reason: ${reason}` : ''}`,
        link: '/employee'
      });

      // In-app notification to employee's manager
      if (leaveRequest.user.managerId) {
        await NotificationService.createNotification({
          userId: leaveRequest.user.managerId,
          type: 'LEAVE_CANCELLED',
          title: 'Leave Request Cancelled',
          message: `${employeeName}'s ${leaveTypeName} for ${dateRange} was cancelled by ${executiveName}.`,
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
          type: 'LEAVE_CANCELLED',
          title: 'Leave Request Cancelled',
          message: `${employeeName}'s ${leaveTypeName} for ${dateRange} was cancelled by ${executiveName}.`,
          link: '/hr'
        });
      }

      // Email to employee
      if (leaveRequest.user.email) {
        emailService.sendCancellationNotification(leaveRequest.user.email, {
          employeeName,
          leaveType: leaveTypeName,
          startDate: leaveRequest.startDate.toDateString(),
          endDate: leaveRequest.endDate.toDateString(),
          totalDays: leaveRequest.totalDays,
          cancelledBy: executiveName,
          reason,
          recipientType: 'employee',
          recipientName: leaveRequest.user.firstName ?? '',
          companyName
        });
      }

      // Email to manager
      if (leaveRequest.user.managerId) {
        const manager = await prisma.user.findUnique({
          where: { id: leaveRequest.user.managerId },
          select: { email: true, firstName: true }
        });
        if (manager?.email) {
          emailService.sendCancellationNotification(manager.email, {
            employeeName,
            leaveType: leaveTypeName,
            startDate: leaveRequest.startDate.toDateString(),
            endDate: leaveRequest.endDate.toDateString(),
            totalDays: leaveRequest.totalDays,
            cancelledBy: executiveName,
            reason,
            recipientType: 'manager',
            recipientName: manager.firstName ?? '',
            companyName
          });
        }
      }

      // Email to HR users
      for (const hrUser of hrUsers) {
        if (hrUser.email) {
          emailService.sendCancellationNotification(hrUser.email, {
            employeeName,
            leaveType: leaveTypeName,
            startDate: leaveRequest.startDate.toDateString(),
            endDate: leaveRequest.endDate.toDateString(),
            totalDays: leaveRequest.totalDays,
            cancelledBy: executiveName,
            reason,
            recipientType: 'hr',
            recipientName: hrUser.firstName ?? '',
            companyName
          });
        }
      }
    } catch (notificationError) {
      console.error('Error sending cancellation notifications:', notificationError);
    }

    return NextResponse.json({
      message: 'Leave request cancelled successfully',
      requestId: updatedRequest.id
    });
  } catch (error: any) {
    if (error?.message === 'ALREADY_CANCELLED') {
      return NextResponse.json(
        { error: 'Request was already cancelled or status changed' },
        { status: 409 }
      );
    }
    console.error('Error cancelling leave request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel leave request' },
      { status: 500 }
    );
  }
}
