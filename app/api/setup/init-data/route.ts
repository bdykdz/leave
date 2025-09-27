import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { WorkflowEngine } from '@/lib/services/workflow-engine'

export async function POST(request: NextRequest) {
  // Check if user is authenticated for setup
  const setupAuth = cookies().get('setup-auth')
  if (!setupAuth?.value) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Check if leave types exist
    const leaveTypeCount = await prisma.leaveType.count()
    
    if (leaveTypeCount === 0) {
      // Create default leave types
      const leaveTypes = await Promise.all([
        prisma.leaveType.create({
          data: {
            name: 'Annual Leave',
            code: 'AL',
            daysAllowed: 21,
            carryForward: true,
            maxCarryForward: 5,
            requiresApproval: true,
            description: 'Paid annual vacation leave'
          }
        }),
        prisma.leaveType.create({
          data: {
            name: 'Sick Leave',
            code: 'SL',
            daysAllowed: 10,
            carryForward: false,
            requiresApproval: true,
            requiresDocument: true,
            description: 'Paid sick leave with medical certificate'
          }
        }),
        prisma.leaveType.create({
          data: {
            name: 'Personal Leave',
            code: 'PL',
            daysAllowed: 5,
            carryForward: false,
            requiresApproval: true,
            description: 'Unpaid personal leave'
          }
        })
      ])

      // Also initialize workflow rules
      const workflowEngine = new WorkflowEngine()
      await workflowEngine.createDefaultWorkflowRules()

      return NextResponse.json({
        success: true,
        message: 'Leave types and workflow rules created',
        count: leaveTypes.length
      })
    }

    // Check workflow rules
    const workflowCount = await prisma.workflowRule.count()
    if (workflowCount === 0) {
      const workflowEngine = new WorkflowEngine()
      await workflowEngine.createDefaultWorkflowRules()
    }

    return NextResponse.json({
      success: true,
      message: 'Data already initialized',
      leaveTypes: leaveTypeCount,
      workflowRules: workflowCount
    })
  } catch (error) {
    console.error('Error initializing data:', error)
    return NextResponse.json(
      { error: 'Failed to initialize data' },
      { status: 500 }
    )
  }
}