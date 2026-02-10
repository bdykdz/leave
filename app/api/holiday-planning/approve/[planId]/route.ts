import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { PlanStatus } from '@prisma/client'
import { emailService, HolidayPlanApprovalEmailData } from '@/lib/email-service'
import { AuditService } from '@/lib/services/audit-service'
import { rateLimit, rateLimitConfigs } from '@/lib/middleware/rate-limit'
import { z } from 'zod'

function getAuditContext(request: NextRequest, sessionId?: string) {
  return {
    sessionId,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    requestId: crypto.randomUUID()
  }
}

const approvalSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_revision']),
  comments: z.string().max(1000).optional().transform(val => {
    // Basic sanitization: trim whitespace and remove potentially harmful characters
    return val ? val.trim().replace(/[<>]/g, '') : undefined
  })
})

export async function POST(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  // Apply rate limiting for approval actions
  const rateLimitResponse = rateLimit(rateLimitConfigs.approval)(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, comments } = approvalSchema.parse(body)
    const planId = params.planId

    // Get the plan and verify permissions
    const plan = await prisma.holidayPlan.findUnique({
      where: { id: planId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            managerId: true,
            departmentDirectorId: true,
            department: true
          }
        },
        dates: true
      }
    })

    if (!plan) {
      return NextResponse.json({ error: 'Holiday plan not found' }, { status: 404 })
    }

    // Check if plan is in a valid state for approval
    if (plan.status !== PlanStatus.SUBMITTED) {
      return NextResponse.json({ 
        error: 'Plan cannot be approved in current status', 
        currentStatus: plan.status 
      }, { status: 400 })
    }

    // Check if user has permission to approve this plan
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user?.id },
      select: { role: true, id: true, department: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Permission check
    const hasPermission = 
      (currentUser.role === 'MANAGER' && plan.user.managerId === currentUser.id) ||
      (currentUser.role === 'DIRECTOR' && plan.user.departmentDirectorId === currentUser.id) ||
      (currentUser.role === 'EXECUTIVE')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Update plan status based on action
    let newStatus: PlanStatus
    switch (action) {
      case 'approve':
        newStatus = PlanStatus.REVIEWED
        break
      case 'reject':
        newStatus = PlanStatus.DRAFT
        break
      case 'request_revision':
        newStatus = PlanStatus.DRAFT
        break
    }

    // Update the plan
    const updatedPlan = await prisma.holidayPlan.update({
      where: { id: planId },
      data: {
        status: newStatus,
        notes: comments
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        dates: true
      }
    })

    // Get manager/approver info for email
    const approverName = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { firstName: true, lastName: true }
    })

    // Send email notification to employee
    const emailData: HolidayPlanApprovalEmailData = {
      employeeName: `${plan.user.firstName} ${plan.user.lastName}`,
      managerName: `${approverName?.firstName} ${approverName?.lastName}`,
      year: plan.year,
      totalDays: plan.dates.length,
      status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'needs_revision',
      comments,
      companyName: process.env.COMPANY_NAME || 'TPF',
      planId: plan.id
    }

    // Log audit trail
    let auditAction: 'APPROVED' | 'REJECTED'
    if (action === 'approve') {
      auditAction = 'APPROVED'
    } else {
      auditAction = 'REJECTED' // Both reject and request_revision are logged as rejected
    }
    
    await AuditService.logHolidayPlan({
      action: auditAction,
      planId: plan.id,
      userId: currentUser.id,
      oldPlan: plan,
      newPlan: updatedPlan,
      context: getAuditContext(request, session.user?.id)
    })

    try {
      await emailService.sendHolidayPlanApprovalNotification(plan.user.email, emailData)
    } catch (emailError) {
      console.error('Error sending approval notification:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ 
      message: 'Holiday plan updated successfully',
      plan: updatedPlan 
    })

  } catch (error: any) {
    console.error('Error approving holiday plan:', error)
    console.error('Error stack:', error.stack)
    console.error('Plan ID:', params.planId)
    console.error('Action:', body)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to update holiday plan',
        details: error.message,
        planId: params.planId
      },
      { status: 500 }
    )
  }
}