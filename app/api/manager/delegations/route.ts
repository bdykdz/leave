import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET: Fetch user's delegations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a manager
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['MANAGER', 'ADMIN', 'HR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const delegations = await prisma.approvalDelegate.findMany({
      where: {
        delegatorId: session.user.id
      },
      include: {
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            position: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ delegations });
  } catch (error) {
    console.error('Error fetching delegations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delegations' },
      { status: 500 }
    );
  }
}

// POST: Create new delegation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a manager
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !['MANAGER', 'ADMIN', 'HR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const data = await request.json();

    // Validate delegate
    if (data.delegateToId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delegate to yourself' },
        { status: 400 }
      );
    }

    // Check if delegate is a valid manager
    const delegateTo = await prisma.user.findUnique({
      where: { id: data.delegateToId },
      select: { role: true }
    });

    if (!delegateTo || !['MANAGER', 'ADMIN', 'HR', 'EXECUTIVE'].includes(delegateTo.role)) {
      return NextResponse.json(
        { error: 'Selected user is not authorized to approve requests' },
        { status: 400 }
      );
    }

    // Check for overlapping active delegations
    const overlapping = await prisma.approvalDelegate.findFirst({
      where: {
        delegatorId: session.user.id,
        isActive: true,
        OR: [
          {
            // Indefinite delegation
            endDate: null
          },
          {
            // Date range overlap
            AND: [
              {
                startDate: {
                  lte: data.endDate ? new Date(data.endDate) : new Date('2100-01-01')
                }
              },
              {
                OR: [
                  { endDate: null },
                  {
                    endDate: {
                      gte: new Date(data.startDate)
                    }
                  }
                ]
              }
            ]
          }
        ]
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
        delegateId: data.delegateToId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        reason: data.reason,
        isActive: true
      },
      include: {
        delegate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            position: true
          }
        }
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