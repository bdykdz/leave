import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PATCH update rule priority
export async function PATCH(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { direction } = await request.json();
    if (!['up', 'down'].includes(direction)) {
      return NextResponse.json(
        { error: 'Invalid direction. Must be "up" or "down"' },
        { status: 400 }
      );
    }

    // Get current rule
    const currentRule = await prisma.workflowRule.findUnique({
      where: { id: params.ruleId },
    });

    if (!currentRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Get adjacent rule based on direction
    const adjacentRule = await prisma.workflowRule.findFirst({
      where: direction === 'up'
        ? { priority: { gt: currentRule.priority } }
        : { priority: { lt: currentRule.priority } },
      orderBy: { priority: direction === 'up' ? 'asc' : 'desc' },
    });

    if (!adjacentRule) {
      return NextResponse.json(
        { error: 'Cannot move rule in that direction' },
        { status: 400 }
      );
    }

    // Swap priorities
    await prisma.$transaction([
      prisma.workflowRule.update({
        where: { id: currentRule.id },
        data: { priority: adjacentRule.priority },
      }),
      prisma.workflowRule.update({
        where: { id: adjacentRule.id },
        data: { priority: currentRule.priority },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update priority error:', error);
    return NextResponse.json(
      { error: 'Failed to update priority' },
      { status: 500 }
    );
  }
}