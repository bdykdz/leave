import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET single workflow rule
export async function GET(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rule = await prisma.workflowRule.findUnique({
      where: { id: params.ruleId },
    });

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Get workflow rule error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow rule' },
      { status: 500 }
    );
  }
}

// PATCH update workflow rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const {
      name,
      description,
      conditions,
      approvalLevels,
      priority,
      skipDuplicateSignatures,
      autoApproveConditions,
      isActive,
    } = data;

    const rule = await prisma.workflowRule.update({
      where: { id: params.ruleId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(conditions !== undefined && { conditions }),
        ...(approvalLevels !== undefined && { approvalLevels }),
        ...(priority !== undefined && { priority }),
        ...(skipDuplicateSignatures !== undefined && { skipDuplicateSignatures }),
        ...(autoApproveConditions !== undefined && { autoApproveConditions }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Update workflow rule error:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow rule' },
      { status: 500 }
    );
  }
}

// DELETE workflow rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.workflowRule.delete({
      where: { id: params.ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workflow rule error:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow rule' },
      { status: 500 }
    );
  }
}