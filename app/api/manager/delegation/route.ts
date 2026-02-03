import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: Fetch current delegations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a manager/director/executive
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['MANAGER', 'HR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized to manage delegations' }, { status: 403 });
    }

    // Get active delegations for this user
    const delegations = await prisma.approvalDelegate.findMany({
      where: {
        delegatorId: session.user.id,
        endDate: { gte: new Date() }
      },
      include: {
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    // Get potential delegates (managers in same department or HR)
    const potentialDelegates = await prisma.user.findMany({
      where: {
        OR: [
          {
            role: { in: ['MANAGER', 'HR', 'EXECUTIVE'] },
            departmentId: session.user.departmentId,
            id: { not: session.user.id }
          },
          {
            role: 'HR'
          }
        ],
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: {
          select: {
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      delegations,
      potentialDelegates
    });
  } catch (error) {
    console.error('Error fetching delegations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delegations' },
      { status: 500 }
    );
  }
}

// POST: Create a new delegation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delegateId, startDate, endDate, reason } = await request.json();

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    if (start < new Date()) {
      return NextResponse.json(
        { error: 'Start date cannot be in the past' },
        { status: 400 }
      );
    }

    // Check if delegate is valid
    const delegate = await prisma.user.findUnique({
      where: { id: delegateId },
      select: { role: true, isActive: true }
    });

    if (!delegate?.isActive) {
      return NextResponse.json(
        { error: 'Selected delegate is not active' },
        { status: 400 }
      );
    }

    if (!['MANAGER', 'HR', 'EXECUTIVE'].includes(delegate.role)) {
      return NextResponse.json(
        { error: 'Selected user cannot act as a delegate' },
        { status: 400 }
      );
    }

    // Check for overlapping delegations
    const overlapping = await prisma.approvalDelegate.findFirst({
      where: {
        delegatorId: session.user.id,
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start }
          }
        ],
        isActive: true
      }
    });

    if (overlapping) {
      return NextResponse.json(
        { error: 'You already have an active delegation for this period' },
        { status: 400 }
      );
    }

    // Create delegation
    const delegation = await prisma.approvalDelegate.create({
      data: {
        delegatorId: session.user.id,
        delegateId,
        startDate: start,
        endDate: end,
        reason,
        isActive: true
      },
      include: {
        delegate: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Create notification for delegate
    await prisma.notification.create({
      data: {
        userId: delegateId,
        type: 'GENERAL',
        title: 'Approval Delegation Assigned',
        message: `You have been assigned as an approval delegate from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
        link: '/manager/delegations'
      }
    });

    return NextResponse.json({
      message: 'Delegation created successfully',
      delegation
    });
  } catch (error) {
    console.error('Error creating delegation:', error);
    return NextResponse.json(
      { error: 'Failed to create delegation' },
      { status: 500 }
    );
  }
}

// DELETE: Cancel a delegation
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const delegationId = searchParams.get('id');

    if (!delegationId) {
      return NextResponse.json(
        { error: 'Delegation ID required' },
        { status: 400 }
      );
    }

    // Check ownership
    const delegation = await prisma.approvalDelegate.findUnique({
      where: { id: delegationId },
      include: {
        delegate: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!delegation || delegation.delegatorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Delegation not found or not authorized' },
        { status: 404 }
      );
    }

    // Mark as inactive instead of deleting
    await prisma.approvalDelegate.update({
      where: { id: delegationId },
      data: { isActive: false }
    });

    // Notify delegate
    await prisma.notification.create({
      data: {
        userId: delegation.delegateId,
        type: 'GENERAL',
        title: 'Approval Delegation Cancelled',
        message: `Your approval delegation has been cancelled`,
        link: '/manager/delegations'
      }
    });

    return NextResponse.json({
      message: 'Delegation cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling delegation:', error);
    return NextResponse.json(
      { error: 'Failed to cancel delegation' },
      { status: 500 }
    );
  }
}