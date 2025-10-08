import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// POST: Cancel a WFH request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { reason } = await request.json();

    // For WFH requests, we treat them as leave requests with WFH type
    // First, find the WFH leave type
    const wfhLeaveType = await prisma.leaveType.findFirst({
      where: { code: 'WFH' }
    });

    if (!wfhLeaveType) {
      return NextResponse.json({ error: 'WFH leave type not configured' }, { status: 500 });
    }

    // Fetch the WFH request (which is actually a leave request with WFH type)
    const wfhRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        leaveType: true
      }
    });

    if (!wfhRequest) {
      return NextResponse.json({ error: 'WFH request not found' }, { status: 404 });
    }

    // Verify it's actually a WFH request
    if (wfhRequest.leaveType.code !== 'WFH') {
      return NextResponse.json({ error: 'Not a WFH request' }, { status: 400 });
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

    // Cancel the request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        approverComments: reason || 'Cancelled by administrator',
        approvedAt: new Date(),
        approverId: session.user.id
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REQUEST_CANCELLED',
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