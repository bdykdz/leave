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
    const { updatedRequest, allApproved } = await prisma.$transaction(async (tx) => {
      // CRITICAL FIX: Update the HR Approval record
      // Only match the approval record for this specific HR user — never fall back to
      // level-based matching, as that can accidentally approve a manager's approval record.
      const hrApproval = leaveRequest.approvals.find(
        a => a.approverId === session.user.id && a.status === 'PENDING'
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

      // Check if ALL approvals are now complete (HR verification might be the only/last step)
      const allApprovals = await tx.approval.findMany({
        where: { leaveRequestId: params.id }
      })
      const isAllApproved = approved && allApprovals.length > 0 && allApprovals.every(
        a => a.status === 'APPROVED' || (a.id === hrApproval?.id) // the one we just updated
      )

      // Determine the correct status:
      // - If rejected: REJECTED
      // - If all approvals are done: APPROVED
      // - Otherwise: PENDING (waiting for remaining approvals)
      let newStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING'
      if (!approved) {
        newStatus = 'REJECTED'
      } else if (isAllApproved) {
        newStatus = 'APPROVED'
      }

      // Update the leave request with verification status
      const updated = await tx.leaveRequest.update({
        where: { id: params.id },
        data: {
          hrDocumentVerified: approved,
          hrVerifiedBy: session.user.id,
          hrVerifiedAt: new Date(),
          hrVerificationNotes: notes,
          status: newStatus,
        },
      })

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

      // If fully approved, update leave balance (pending → used)
      if (isAllApproved && leaveRequest.leaveTypeId && leaveRequest.totalDays > 0) {
        const balanceYear = new Date(leaveRequest.startDate).getFullYear()
        try {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              userId_leaveTypeId_year: {
                userId: leaveRequest.userId,
                leaveTypeId: leaveRequest.leaveTypeId,
                year: balanceYear
              }
            }
          })
          if (balance) {
            const totalDays = leaveRequest.totalDays
            const remainingCF = Math.max(0, balance.carriedForward - balance.carriedForwardUsed)
            const cfDeduction = Math.min(totalDays, remainingCF)
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                pending: balance.pending - totalDays,
                used: balance.used + totalDays,
                carriedForwardUsed: balance.carriedForwardUsed + cfDeduction,
                available: balance.entitled + balance.carriedForward - (balance.used + totalDays) - (balance.pending - totalDays)
              }
            })
          }
        } catch (balanceError) {
          console.error('Failed to update leave balance on full approval:', balanceError)
          throw balanceError
        }
      }

      // Create notification for the employee
      await tx.notification.create({
        data: {
          userId: leaveRequest.userId,
          type: approved ? 'LEAVE_REQUESTED' : 'LEAVE_REJECTED',
          title: approved
            ? (isAllApproved ? 'Leave Request Approved' : 'Documents Verified')
            : 'Documents Rejected',
          message: approved
            ? (isAllApproved
              ? `Your ${leaveRequest.leaveType.name} request has been fully approved.`
              : `Your supporting documents for ${leaveRequest.leaveType.name} have been verified. Your request is now pending manager approval.`)
            : `Your supporting documents for ${leaveRequest.leaveType.name} were not approved. ${notes ? 'Reason: ' + notes : 'Please contact HR for more information.'}`,
          link: `/leave-requests/${leaveRequest.id}`,
        },
      })

      // If approved but not fully done, notify the next approver in the chain
      if (approved && !isAllApproved) {
        const nextPending = allApprovals.find(
          a => a.status === 'PENDING' && a.id !== hrApproval?.id
        )
        if (nextPending?.approverId) {
          await tx.notification.create({
            data: {
              userId: nextPending.approverId,
              type: 'APPROVAL_REQUIRED',
              title: 'Leave Request Pending Approval',
              message: `${leaveRequest.user?.firstName || ''} ${leaveRequest.user?.lastName || ''} has submitted a ${leaveRequest.leaveType?.name || 'leave'} request (HR verified).`,
              link: `/leave-requests/${leaveRequest.id}`,
            },
          })
        }
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

      return { updatedRequest: updated, allApproved: isAllApproved }
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

    // If approved, email the next approver in the chain
    if (approved) {
      try {
        // Re-fetch approvals to get updated state after transaction
        const updatedApprovals = await prisma.approval.findMany({
          where: { leaveRequestId: params.id },
          orderBy: { level: 'asc' },
        })
        const nextPendingApproval = updatedApprovals.find(a => a.status === 'PENDING')
        if (nextPendingApproval?.approverId) {
          const nextApprover = await prisma.user.findUnique({
            where: { id: nextPendingApproval.approverId },
            select: { email: true, firstName: true, lastName: true }
          })

          if (nextApprover?.email) {
            await emailService.sendLeaveRequestNotification(nextApprover.email, {
              employeeName: `${leaveRequest.user?.firstName || ''} ${leaveRequest.user?.lastName || ''}`,
              leaveType: `${leaveRequest.leaveType.name} - Document Verification Complete`,
              startDate: format(new Date(leaveRequest.startDate), 'dd MMMM yyyy'),
              endDate: format(new Date(leaveRequest.endDate), 'dd MMMM yyyy'),
              days: leaveRequest.totalDays,
              managerName: `${nextApprover.firstName} ${nextApprover.lastName}`,
              companyName: process.env.COMPANY_NAME || 'TPF',
              requestId: leaveRequest.id
            })

            console.log('Next approver notification email sent after HR verification', {
              requestId: leaveRequest.id,
              approverEmail: nextApprover.email
            })
          }
        }
      } catch (emailError) {
        console.error('Failed to send next approver notification email:', emailError)
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
