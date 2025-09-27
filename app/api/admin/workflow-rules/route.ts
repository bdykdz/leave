import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { WorkflowEngine } from '@/lib/services/workflow-engine';

const prisma = new PrismaClient();
const workflowEngine = new WorkflowEngine();

// GET list all workflow rules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rules = await prisma.workflowRule.findMany({
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Get workflow rules error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow rules' },
      { status: 500 }
    );
  }
}

// POST create new workflow rule
export async function POST(request: NextRequest) {
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
    } = data;

    // Validate required fields
    if (!name || !conditions || !approvalLevels) {
      return NextResponse.json(
        { error: 'Name, conditions, and approval levels are required' },
        { status: 400 }
      );
    }

    // Create rule
    const rule = await prisma.workflowRule.create({
      data: {
        name,
        description: description || null,
        conditions,
        approvalLevels,
        priority: priority || 0,
        skipDuplicateSignatures: skipDuplicateSignatures !== false,
        autoApproveConditions: autoApproveConditions || null,
        isActive: true,
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Create workflow rule error:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow rule' },
      { status: 500 }
    );
  }
}

// Initialize default rules if none exist
export async function initializeDefaultRules() {
  try {
    const count = await prisma.workflowRule.count();
    if (count === 0) {
      await workflowEngine.createDefaultWorkflowRules();
    }
  } catch (error) {
    console.error('Initialize default rules error:', error);
  }
}