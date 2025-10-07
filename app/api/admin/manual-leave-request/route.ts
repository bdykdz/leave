import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

async function generateUniqueRequestNumber(prefix: string) {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}${month}-${randomNum}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    // Generate unique request number
    const requestNumber = await generateUniqueRequestNumber('LR');

    // Create the leave request with immediate approval
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        requestNumber,
        userId: data.userId,
        leaveTypeId: data.leaveTypeId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        totalDays: data.totalDays || 1,
        reason: data.reason || 'Created by Admin/HR',
        status: data.status || 'APPROVED',
        supportingDocuments: data.supportingDocuments || [],
        hrNotes: data.hrNotes,
        createdByAdminId: session.user.id,
        isHalfDay: data.isHalfDay || false,
        // Mark as already approved if status is APPROVED
        managerApprovedBy: data.status === 'APPROVED' ? session.user.id : null,
        managerApprovedAt: data.status === 'APPROVED' ? new Date() : null,
        hrApprovedBy: data.status === 'APPROVED' ? session.user.id : null,
        hrApprovedAt: data.status === 'APPROVED' ? new Date() : null,
      },
      include: {
        user: true,
        leaveType: true,
      }
    });

    // Update leave balance if approved
    if (data.status === 'APPROVED') {
      const leaveBalance = await prisma.leaveBalance.findFirst({
        where: {
          userId: data.userId,
          leaveTypeId: data.leaveTypeId,
          year: new Date().getFullYear(),
        }
      });

      if (leaveBalance) {
        await prisma.leaveBalance.update({
          where: { id: leaveBalance.id },
          data: {
            used: leaveBalance.used + data.totalDays,
            available: Math.max(0, leaveBalance.available - data.totalDays),
          }
        });
      }
    }

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: 'LEAVE_REQUEST_CREATED',
        title: 'Leave Request Created by HR',
        message: `A leave request has been created on your behalf by ${session.user.firstName} ${session.user.lastName}`,
        relatedEntityId: leaveRequest.id,
        relatedEntityType: 'LEAVE_REQUEST',
      }
    });

    return NextResponse.json({
      success: true,
      request: leaveRequest,
    });
  } catch (error) {
    console.error('Error creating manual leave request:', error);
    return NextResponse.json(
      { error: 'Failed to create leave request' },
      { status: 500 }
    );
  }
}
