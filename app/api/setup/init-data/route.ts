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
            daysAllowed: 180,
            carryForward: false,
            requiresApproval: true,
            requiresDocument: true,
            requiresHRVerification: true,
            isHROnly: true,
            documentTypes: ['medical_certificate', 'doctor_note'],
            description: 'Medical leave with doctor certificate - HR managed only'
          }
        }),
        prisma.leaveType.create({
          data: {
            name: 'Marriage Leave',
            code: 'MARR',
            daysAllowed: 5,
            carryForward: false,
            requiresApproval: true,
            requiresDocument: true,
            isSpecialLeave: true,
            requiresHRVerification: true,
            documentTypes: ['marriage_certificate'],
            description: 'Leave for employee marriage',
            category: 'PERSONAL',
          }
        }),
        prisma.leaveType.create({
          data: {
            name: 'Bereavement Leave',
            code: 'BER',
            daysAllowed: 3,
            carryForward: false,
            requiresApproval: true,
            requiresDocument: true,
            isSpecialLeave: true,
            requiresHRVerification: true,
            documentTypes: ['death_certificate'],
            description: 'Leave for death of immediate family member',
            category: 'PERSONAL',
          }
        }),
        prisma.leaveType.create({
          data: {
            name: 'Blood Donation Leave',
            code: 'BDL',
            daysAllowed: 1,
            carryForward: false,
            requiresApproval: true,
            requiresDocument: true,
            documentTypes: ['donation_certificate'],
            description: 'Leave for blood donation',
            category: 'PROVISIONAL',
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
