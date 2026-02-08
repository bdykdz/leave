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
    const requestNumber = await generateUniqueRequestNumber('WFH');

    // Create the WFH request with immediate approval
    const wfhRequest = await prisma.workFromHomeRequest.create({
      data: {
        requestNumber,
        userId: data.userId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason || 'Created by Admin/HR',
        location: data.location || 'Home',
        contactNumber: data.contactNumber,
        status: data.status || 'APPROVED',
        createdByAdminId: session.user.id,
        // Mark as already approved if status is APPROVED
        managerApprovedBy: data.status === 'APPROVED' ? session.user.id : null,
        managerApprovedAt: data.status === 'APPROVED' ? new Date() : null,
        hrApprovedBy: data.status === 'APPROVED' ? session.user.id : null,
        hrApprovedAt: data.status === 'APPROVED' ? new Date() : null,
        hrNotes: data.hrNotes,
      },
      include: {
        user: true,
      }
    });

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: 'WFH_REQUEST_CREATED',
        title: 'Work From Home Request Created by HR',
        message: `A work from home request has been created on your behalf by ${session.user.firstName} ${session.user.lastName}`,
        relatedEntityId: wfhRequest.id,
        relatedEntityType: 'WFH_REQUEST',
      }
    });

    return NextResponse.json({
      success: true,
      request: wfhRequest,
    });
  } catch (error) {
    console.error('Error creating manual WFH request:', error);
    return NextResponse.json(
      { error: 'Failed to create WFH request' },
      { status: 500 }
    );
  }
}
