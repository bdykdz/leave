import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WorkflowEngine } from '@/lib/services/workflow-engine'
import { validateSetupAuth, checkSetupNotComplete } from '@/lib/setup-auth'

export async function POST(request: NextRequest) {
  const authError = await validateSetupAuth()
  if (authError) return authError

  const setupComplete = await checkSetupNotComplete()
  if (setupComplete) return setupComplete

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
            requiresHRVerification: true,
            documentTypes: ['medical_certificate', 'doctor_note'],
            description: 'Paid sick leave with medical certificate - requires HR verification'
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
