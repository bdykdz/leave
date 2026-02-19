import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { logDocumentVerification } from '@/lib/utils/audit-log'
import { emailService } from '@/lib/email-service'
import { format } from 'date-fns'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        department: true,
        firstName: true,
        lastName: true,
        email: true
      }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && (user?.department?.toLowerCase() === 'hr' || user?.department?.toLowerCase() === 'human resources')

    if (!user || (!['HR', 'ADMIN'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { approved, notes } = body

    // Get the leave request with approvals
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        leaveType: true,
        user: true,
        approvals: {
          orderBy: { level: 'asc' }
        },
      },
    })

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      )
    }

    if (!leaveRequest.leaveType.requiresHRVerification) {
      return NextResponse.json(
        { error: 'This leave type does not require HR verification' },
        { status: 400 }
      )
    }

    // Guard: prevent double-processing of already-verified or non-pending requests
    if (leaveRequest.hrDocumentVerified) {
      return NextResponse.json(
        { error: 'This request has already been verified' },
        { status: 400 }
      )
    }

    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request is not in pending status' },
        { status: 400 }
      )
    }

    // Wrap all mutations in a transaction for atomicity
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Update the leave request with verification status
      const updated = await tx.leaveRequest.update({
        where: { id: params.id },
        data: {
          hrDocumentVerified: approved,
          hrVerifiedBy: session.user.id,
          hrVerifiedAt: new Date(),
          hrVerificationNotes: notes,
          status: approved ? 'PENDING' : 'REJECTED',
        },
      })

      // CRITICAL FIX: Update the HR Approval record
      // Find the approval record for this HR user (or fallback to level 1 PENDING)
      const hrApproval = leaveRequest.approvals.find(
        a => a.approverId === session.user.id && a.status === 'PENDING'
      ) || leaveRequest.approvals.find(
        a => a.level === 1 && a.status === 'PENDING'
      )

      if (hrApproval) {
        await tx.approval.update({
          where: { id: hrApproval.id },
          data: {
            status: approved ? 'APPROVED' : 'REJECTED',
            comments: notes || null,
            approvedAt: new Date(),
          },
        })
      }

      // If HR rejects, restore leave balance (pending → available)
      if (!approved && leaveRequest.leaveTypeId && leaveRequest.totalDays > 0) {
        const balanceYear = new Date(leaveRequest.startDate).getFullYear()
        try {
          await tx.leaveBalance.update({
            where: {
              userId_leaveTypeId_year: {
                userId: leaveRequest.userId,
                leaveTypeId: leaveRequest.leaveTypeId,
                year: balanceYear
              }
            },
            data: {
              pending: {
                decrement: leaveRequest.totalDays
              },
              available: {
                increment: leaveRequest.totalDays
              }
            }
          })
        } catch (balanceError) {
          console.error('Failed to restore leave balance on HR rejection:', balanceError)
          throw balanceError // Abort transaction — balance must stay consistent with request status
        }
      }

      // Create notification for the employee
      await tx.notification.create({
        data: {
          userId: leaveRequest.userId,
          type: approved ? 'LEAVE_REQUESTED' : 'LEAVE_REJECTED',
          title: approved
            ? 'Documents Verified'
            : 'Documents Rejected',
          message: approved
            ? `Your supporting documents for ${leaveRequest.leaveType.name} have been verified. Your request is now pending manager approval.`
            : `Your supporting documents for ${leaveRequest.leaveType.name} were not approved. ${notes ? 'Reason: ' + notes : 'Please contact HR for more information.'}`,
          link: `/leave-requests/${leaveRequest.id}`,
        },
      })

      // If approved, notify the manager (in-app)
      if (approved && leaveRequest.user.managerId) {
        await tx.notification.create({
          data: {
            userId: leaveRequest.user.managerId,
            type: 'APPROVAL_REQUIRED',
            title: 'Leave Request Pending Approval',
            message: `${leaveRequest.user?.firstName || ''} ${leaveRequest.user?.lastName || ''} has submitted a ${leaveRequest.leaveType?.name || 'leave'} request (HR verified).`,
            link: `/leave-requests/${leaveRequest.id}`,
          },
        })
      }

      // Create audit log inside transaction
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: approved ? 'HR_DOCUMENT_APPROVED' : 'HR_DOCUMENT_REJECTED',
          entity: 'LeaveRequest',
          entityId: leaveRequest.id,
          newValues: {
            hrDocumentVerified: approved,
            hrVerificationNotes: notes,
          },
        },
      })

      return updated
    })

    // Send email notification to employee for ALL requiresHRVerification types
    if (leaveRequest.leaveType.requiresHRVerification && leaveRequest.user.email) {
      try {
        await emailService.sendLeaveStatusEmail(leaveRequest.user.email, {
          employeeName: `${leaveRequest.user?.firstName || ''} ${leaveRequest.user?.lastName || ''}`,
          leaveType: leaveRequest.leaveType.name,
          startDate: format(new Date(leaveRequest.startDate), 'dd MMMM yyyy'),
          endDate: format(new Date(leaveRequest.endDate), 'dd MMMM yyyy'),
          days: leaveRequest.totalDays,
          status: approved ? 'VERIFIED' : 'REJECTED',
          approverName: `${user.firstName || ''} ${user.lastName || user.email} (HR)`,
          approverComments: notes || (approved
            ? `Your ${leaveRequest.leaveType.name} documents have been verified successfully.`
            : `Your ${leaveRequest.leaveType.name} documents could not be verified. Please contact HR.`),
          companyName: process.env.COMPANY_NAME || 'TPF'
        })

        console.log('Document verification email sent to employee', {
          requestId: leaveRequest.id,
          employee: leaveRequest.user.email,
          leaveType: leaveRequest.leaveType.code,
          approved
        })
      } catch (emailError) {
        console.error('Failed to send document verification email:', emailError)
      }
    }

    // If approved, also email the manager
    if (approved && leaveRequest.user.managerId) {
      try {
        const manager = await prisma.user.findUnique({
          where: { id: leaveRequest.user.managerId },
          select: { email: true, firstName: true, lastName: true }
        })

        if (manager?.email) {
          await emailService.sendLeaveRequestNotification(manager.email, {
            employeeName: `${leaveRequest.user?.firstName || ''} ${leaveRequest.user?.lastName || ''}`,
            leaveType: `${leaveRequest.leaveType.name} - Document Verification Complete`,
            startDate: format(new Date(leaveRequest.startDate), 'dd MMMM yyyy'),
            endDate: format(new Date(leaveRequest.endDate), 'dd MMMM yyyy'),
            days: leaveRequest.totalDays,
            managerName: `${manager.firstName} ${manager.lastName}`,
            companyName: process.env.COMPANY_NAME || 'TPF',
            requestId: leaveRequest.id
          })

          console.log('Manager notification email sent after HR verification', {
            requestId: leaveRequest.id,
            managerEmail: manager.email
          })
        }
      } catch (emailError) {
        console.error('Failed to send manager notification email:', emailError)
      }
    }

    // Log the action with audit helper (outside transaction — supplementary logging)
    await logDocumentVerification(
      session.user.id,
      params.id,
      approved,
      notes
    )

    return NextResponse.json({
      success: true,
      request: updatedRequest,
    })
  } catch (error) {
    console.error('Failed to process verification:', error)
    return NextResponse.json(
      { error: 'Failed to process verification' },
      { status: 500 }
    )
  }
}
