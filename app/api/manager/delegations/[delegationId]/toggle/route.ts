import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// POST: Toggle delegation active status
export async function POST(
  request: NextRequest,
  { params }: { params: { delegationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ownership
    const delegation = await prisma.approvalDelegate.findFirst({
      where: {
        id: params.delegationId,
        delegatorId: session.user.id
      }
    });

    if (!delegation) {
      return NextResponse.json(
        { error: 'Delegation not found or not authorized' },
        { status: 404 }
      );
    }

    // If activating, deactivate other active delegations
    if (!delegation.isActive) {
      await prisma.approvalDelegate.updateMany({
        where: {
          delegatorId: session.user.id,
          isActive: true,
          id: {
            not: params.delegationId
          }
        },
        data: {
          isActive: false
        }
      });
    }

    // Toggle the status
    const updatedDelegation = await prisma.approvalDelegate.update({
      where: { id: params.delegationId },
      data: {
        isActive: !delegation.isActive
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
      message: `Delegation ${updatedDelegation.isActive ? 'activated' : 'deactivated'} successfully`,
      delegation: updatedDelegation
    });
  } catch (error) {
    console.error('Error toggling delegation:', error);
    return NextResponse.json(
      { error: 'Failed to toggle delegation' },
      { status: 500 }
    );
  }
}