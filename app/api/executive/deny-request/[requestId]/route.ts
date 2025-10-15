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

    if (!comment || comment.trim() === '') {
      return NextResponse.json(
        { error: 'Comment is required when denying a request' },
        { status: 400 }
      );
    }

    // Update the approval record for this executive
    await prisma.approval.updateMany({
      where: {
        leaveRequestId: params.requestId,
        approverId: session.user.id,
        status: 'PENDING'
      },
      data: {
        status: 'REJECTED',
        comment: comment,
        approvedAt: new Date()
      }
    });

    // Update the leave request status to rejected
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'REJECTED'
      },
      include: {
        user: true,
        leaveType: true
      }
    });

    // Send notification to the employee
    await prisma.notification.create({
      data: {
        userId: updatedRequest.userId,
        type: 'LEAVE_REJECTED',
        title: 'Leave Request Denied',
        message: `Your ${updatedRequest.leaveType.name} request has been denied by executive management. Reason: ${comment}`,
        relatedEntityId: params.requestId,
        relatedEntityType: 'LEAVE_REQUEST'
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Request denied successfully',
      request: updatedRequest 
    });
  } catch (error) {
    console.error('Error denying request:', error);
    return NextResponse.json(
      { error: 'Failed to deny request' },
      { status: 500 }
    );
  }
}
