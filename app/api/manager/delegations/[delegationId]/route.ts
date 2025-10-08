import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// PUT: Update delegation
export async function PUT(
  request: NextRequest,
  { params }: { params: { delegationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ownership
    const existingDelegation = await prisma.managerDelegation.findFirst({
      where: {
        id: params.delegationId,
        delegatedById: session.user.id
      }
    });

    if (!existingDelegation) {
      return NextResponse.json(
        { error: 'Delegation not found or not authorized' },
        { status: 404 }
      );
    }

    const data = await request.json();

    // Validate delegate
    if (data.delegateToId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delegate to yourself' },
        { status: 400 }
      );
    }

    // Update delegation
    const delegation = await prisma.managerDelegation.update({
      where: { id: params.delegationId },
      data: {
        delegateToId: data.delegateToId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        reason: data.reason
      },
      include: {
        delegateTo: {
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
      message: 'Delegation updated successfully',
      delegation 
    });
  } catch (error) {
    console.error('Error updating delegation:', error);
    return NextResponse.json(
      { error: 'Failed to update delegation' },
      { status: 500 }
    );
  }
}

// DELETE: Delete delegation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { delegationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ownership
    const delegation = await prisma.managerDelegation.findFirst({
      where: {
        id: params.delegationId,
        delegatedById: session.user.id
      }
    });

    if (!delegation) {
      return NextResponse.json(
        { error: 'Delegation not found or not authorized' },
        { status: 404 }
      );
    }

    await prisma.managerDelegation.delete({
      where: { id: params.delegationId }
    });

    return NextResponse.json({ 
      message: 'Delegation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting delegation:', error);
    return NextResponse.json(
      { error: 'Failed to delete delegation' },
      { status: 500 }
    );
  }
}