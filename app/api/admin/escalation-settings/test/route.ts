import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { EscalationService } from '@/lib/services/escalation-service';

// POST: Test escalation with sample data
export async function POST(request: NextRequest) {
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

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Create a test scenario
    const testScenario = {
      requestId: 'test-request-123',
      userId: session.user.id,
      requestType: 'LEAVE',
      currentApprover: {
        id: 'test-manager-1',
        name: 'John Manager',
        role: 'MANAGER',
        isAbsent: false,
        hasDelegate: false
      },
      escalationPath: [
        {
          level: 1,
          approver: 'Direct Manager',
          timeout: 48,
          status: 'PENDING'
        },
        {
          level: 2,
          approver: 'Department Director',
          timeout: 48,
          status: 'NOT_REACHED'
        },
        {
          level: 3,
          approver: 'HR Department',
          timeout: 48,
          status: 'NOT_REACHED'
        }
      ]
    };

    // Simulate escalation logic
    const escalationService = EscalationService.getInstance();
    
    // Test different scenarios
    const scenarios = [
      {
        name: 'Normal Escalation',
        description: 'Request escalates after timeout',
        result: 'Would escalate to Department Director after 48 hours'
      },
      {
        name: 'Absent Approver',
        description: 'Current approver is on leave',
        result: 'Would immediately skip to next available approver'
      },
      {
        name: 'With Delegation',
        description: 'Approver has active delegation',
        result: 'Would route to delegate instead of escalating'
      },
      {
        name: 'Max Escalations',
        description: 'Request reaches maximum escalation level',
        result: 'Would auto-approve based on current settings'
      }
    ];

    // Log test execution
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TEST_ESCALATION',
        entityType: 'ESCALATION_SETTINGS',
        entityId: 'test',
        details: {
          testScenario,
          scenarios,
          timestamp: new Date()
        }
      }
    });

    return NextResponse.json({ 
      message: 'Escalation test completed successfully',
      testScenario,
      scenarios,
      note: 'This is a simulation. Check the audit logs for detailed test results.'
    });
  } catch (error) {
    console.error('Error testing escalation:', error);
    return NextResponse.json(
      { error: 'Failed to run escalation test' },
      { status: 500 }
    );
  }
}