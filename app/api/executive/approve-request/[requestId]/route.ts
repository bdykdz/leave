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

    // Update the leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'APPROVED',
        executiveApprovedBy: session.user.id,
        executiveApprovedAt: new Date(),
        executiveComment: comment || null
      },
      include: {
        user: true,
        leaveType: true
      }
    });

    // Create an approval record
    await prisma.approval.create({
      data: {
        leaveRequestId: params.requestId,
        approverId: session.user.id,
        status: 'APPROVED',
        comment: comment || null,
        approvedAt: new Date()
      }
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
