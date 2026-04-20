import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'
import { sanitizeComment } from '@/lib/utils/sanitize'
import { checkSelectedDatesOverlap, hasActualDateOverlap } from '@/lib/utils/date-validation'
import { WorkingDaysService } from '@/lib/services/working-days-service'
import { emailService } from '@/lib/email-service'
import { eachDayOfInterval, format } from 'date-fns'

// PUT: Edit a leave request (HR/Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, firstName: true, lastName: true, email: true }
    })

    if (!currentUser || !['HR', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const {
      leaveTypeId,
      startDate,
      endDate,
      totalDays,
      reason,
      substituteIds,
      selectedDates,
      editReason,
    } = body

    if (!editReason || !String(editReason).trim()) {
      return NextResponse.json({ error: 'Edit reason is required' }, { status: 400 })
    }

    const sanitizedEditReason = sanitizeComment(String(editReason)).slice(0, 1000)

    // Fetch existing request with all relations
    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        user: {
          include: {
            manager: { select: { id: true, firstName: true, lastName: true, email: true, role: true, department: true } },
            departmentDirector: { select: { id: true } },
          }
        },
        leaveType: true,
        approvals: true,
        substitutes: true,
        generatedDocument: true,
      }
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    // Validate status
    if (existingRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot edit a cancelled request' }, { status: 400 })
    }

    // If approved, check that leave hasn't started
    if (existingRequest.status === 'APPROVED') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (existingRequest.startDate <= today) {
        return NextResponse.json({ error: 'Cannot edit an approved request that has already started' }, { status: 400 })
      }
    }

    // Determine new values (use existing if not provided)
    const newLeaveTypeId = leaveTypeId || existingRequest.leaveTypeId
    const newStartDate = startDate ? new Date(startDate) : existingRequest.startDate
    const newEndDate = endDate ? new Date(endDate) : existingRequest.endDate
    const newReason = reason !== undefined ? sanitizeComment(String(reason)).slice(0, 2000) : existingRequest.reason

    if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (newEndDate < newStartDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    const daySpan = Math.round((newEndDate.getTime() - newStartDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daySpan > 366) {
      return NextResponse.json({ error: 'Date range cannot exceed 366 days' }, { status: 400 })
    }

    // Verify new leave type exists
    const newLeaveType = await prisma.leaveType.findUnique({
      where: { id: newLeaveTypeId },
      select: { id: true, name: true, code: true }
    })

    if (!newLeaveType) {
      return NextResponse.json({ error: 'Leave type not found' }, { status: 404 })
    }

    // Calculate working days for new dates
    const workingDaysService = WorkingDaysService.getInstance()
    let workingDatesList: Date[] = []

    if (selectedDates && Array.isArray(selectedDates) && selectedDates.length > 0) {
      // Use explicitly provided selected dates
      workingDatesList = selectedDates.map((d: string) => new Date(d))
    } else {
      // Calculate working days from date range
      const allDaysInRange = eachDayOfInterval({ start: newStartDate, end: newEndDate })
      for (const day of allDaysInRange) {
        if (await workingDaysService.isWorkingDay(day)) {
          workingDatesList.push(day)
        }
      }
    }

    // Determine totalDays
    let newTotalDays: number
    if (totalDays !== undefined && totalDays !== null) {
      newTotalDays = parseFloat(totalDays)
      if (isNaN(newTotalDays) || newTotalDays <= 0) {
        return NextResponse.json({ error: 'totalDays must be a positive number' }, { status: 400 })
      }
    } else {
      newTotalDays = workingDatesList.length
    }

    if (newTotalDays <= 0) {
      return NextResponse.json({ error: 'No working days in the selected date range' }, { status: 400 })
    }

    // Pre-transaction overlap check (exclude this request)
    const overlapCheck = await checkSelectedDatesOverlap(
      existingRequest.userId,
      workingDatesList,
      existingRequest.id
    )
    if (overlapCheck.hasOverlap) {
      return NextResponse.json(
        { error: 'Date conflict', message: overlapCheck.message },
        { status: 409 }
      )
    }

    // Determine balance years
    const oldBalanceYear = existingRequest.startDate.getFullYear()
    const newBalanceYear = newStartDate.getFullYear()

    // Check new balance availability (accounting for reversal of old deduction)
    const datesOrTypeChanged = newLeaveTypeId !== existingRequest.leaveTypeId ||
      newStartDate.getTime() !== existingRequest.startDate.getTime() ||
      newEndDate.getTime() !== existingRequest.endDate.getTime() ||
      newTotalDays !== existingRequest.totalDays

    // Store old values for audit
    const oldValues = {
      leaveTypeId: existingRequest.leaveTypeId,
      leaveTypeName: existingRequest.leaveType.name,
      startDate: existingRequest.startDate.toISOString(),
      endDate: existingRequest.endDate.toISOString(),
      totalDays: existingRequest.totalDays,
      reason: existingRequest.reason,
      status: existingRequest.status,
      substituteIds: existingRequest.substitutes.map(s => s.userId),
    }

    // Execute everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // In-transaction overlap check (race-condition safe)
      const leaveCandidates = await tx.leaveRequest.findMany({
        where: {
          userId: existingRequest.userId,
          status: { in: ['APPROVED', 'PENDING'] },
          id: { not: existingRequest.id },
          startDate: { lte: newEndDate },
          endDate: { gte: newStartDate },
        },
        select: { id: true, startDate: true, endDate: true, selectedDates: true }
      })

      const incomingRequest = { startDate: newStartDate, endDate: newEndDate, selectedDates: workingDatesList }
      const overlappingLeave = leaveCandidates.find(c => hasActualDateOverlap(c, incomingRequest))

      if (overlappingLeave) {
        throw new Error(`DATE_CONFLICT:Employee already has a leave request from ${overlappingLeave.startDate.toLocaleDateString()} to ${overlappingLeave.endDate.toLocaleDateString()}. Please choose different dates.`)
      }

      // 1. REVERSE old balance impact
      if (existingRequest.status === 'PENDING') {
        // Reverse pending deduction
        await tx.leaveBalance.update({
          where: {
            userId_leaveTypeId_year: {
              userId: existingRequest.userId,
              leaveTypeId: existingRequest.leaveTypeId,
              year: oldBalanceYear,
            }
          },
          data: {
            pending: { decrement: existingRequest.totalDays },
            available: { increment: existingRequest.totalDays },
          }
        })
      } else if (existingRequest.status === 'APPROVED') {
        // Reverse used deduction with FIFO carry-forward restore
        const balance = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: existingRequest.userId,
              leaveTypeId: existingRequest.leaveTypeId,
              year: oldBalanceYear,
            }
          }
        })
        if (balance) {
          const cfRestore = Math.min(existingRequest.totalDays, Math.max(0, balance.carriedForwardUsed))
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              used: balance.used - existingRequest.totalDays,
              carriedForwardUsed: balance.carriedForwardUsed - cfRestore,
              available: balance.entitled + balance.carriedForward - (balance.used - existingRequest.totalDays) - balance.pending,
            }
          })
        }
      }
      // REJECTED: no balance reversal needed

      // 2. APPLY new balance impact (preserving current status)
      if (existingRequest.status !== 'REJECTED') {
        const existingNewBalance = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: existingRequest.userId,
              leaveTypeId: newLeaveTypeId,
              year: newBalanceYear,
            }
          }
        })

        if (existingNewBalance) {
          // Check if enough balance is available
          const projectedAvailable = existingNewBalance.available - newTotalDays
          if (projectedAvailable < -existingNewBalance.carriedForward) {
            throw new Error('INSUFFICIENT_BALANCE:Insufficient leave balance for this modification')
          }

          if (existingRequest.status === 'APPROVED') {
            // Apply as used — preserve approved status
            const cfConsumed = Math.min(newTotalDays, Math.max(0, existingNewBalance.carriedForward - existingNewBalance.carriedForwardUsed))
            await tx.leaveBalance.update({
              where: {
                userId_leaveTypeId_year: {
                  userId: existingRequest.userId,
                  leaveTypeId: newLeaveTypeId,
                  year: newBalanceYear,
                }
              },
              data: {
                used: existingNewBalance.used + newTotalDays,
                carriedForwardUsed: existingNewBalance.carriedForwardUsed + cfConsumed,
                available: existingNewBalance.entitled + existingNewBalance.carriedForward - (existingNewBalance.used + newTotalDays) - existingNewBalance.pending,
              }
            })
          } else {
            // PENDING — apply as pending
            await tx.leaveBalance.update({
              where: {
                userId_leaveTypeId_year: {
                  userId: existingRequest.userId,
                  leaveTypeId: newLeaveTypeId,
                  year: newBalanceYear,
                }
              },
              data: {
                pending: { increment: newTotalDays },
                available: { decrement: newTotalDays },
              }
            })
          }
        } else {
          // Create a new balance record if none exists
          await tx.leaveBalance.create({
            data: {
              userId: existingRequest.userId,
              leaveTypeId: newLeaveTypeId,
              year: newBalanceYear,
              entitled: 0,
              used: existingRequest.status === 'APPROVED' ? newTotalDays : 0,
              pending: existingRequest.status === 'PENDING' ? newTotalDays : 0,
              available: -newTotalDays,
            }
          })
        }
      }
      // REJECTED: no balance impact needed

      // 3. Update the leave request
      const updatedRequest = await tx.leaveRequest.update({
        where: { id: params.id },
        data: {
          leaveTypeId: newLeaveTypeId,
          startDate: newStartDate,
          endDate: newEndDate,
          totalDays: newTotalDays,
          reason: newReason,
          selectedDates: workingDatesList,
          status: existingRequest.status,
          hrDocumentVerified: datesOrTypeChanged ? false : existingRequest.hrDocumentVerified,
          hrVerifiedBy: datesOrTypeChanged ? null : existingRequest.hrVerifiedBy,
          hrVerifiedAt: datesOrTypeChanged ? null : existingRequest.hrVerifiedAt,
          hrVerificationNotes: datesOrTypeChanged ? null : existingRequest.hrVerificationNotes,
          supportingDocuments: {
            ...(existingRequest.supportingDocuments as any || {}),
            lastEditedBy: currentUser.email,
            lastEditedAt: new Date().toISOString(),
            editReason: sanitizedEditReason,
          },
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
          leaveType: { select: { name: true } },
        }
      })

      // 4. Update substitutes
      await tx.leaveRequestSubstitute.deleteMany({
        where: { leaveRequestId: params.id }
      })

      if (substituteIds && Array.isArray(substituteIds) && substituteIds.length > 0) {
        for (const subId of substituteIds) {
          await tx.leaveRequestSubstitute.create({
            data: {
              leaveRequestId: params.id,
              userId: subId,
            }
          })
        }
        // Also update the legacy substituteId field
        await tx.leaveRequest.update({
          where: { id: params.id },
          data: { substituteId: substituteIds[0] }
        })
      } else if (existingRequest.substitutes.length > 0) {
        // Keep existing substitutes if none provided
        for (const sub of existingRequest.substitutes) {
          await tx.leaveRequestSubstitute.create({
            data: {
              leaveRequestId: params.id,
              userId: sub.userId,
            }
          })
        }
      }

      // 6. Delete generated document if dates/type changed
      if (datesOrTypeChanged && existingRequest.generatedDocument) {
        await tx.documentSignature.deleteMany({
          where: { documentId: existingRequest.generatedDocument.id }
        })
        await tx.generatedDocument.delete({
          where: { id: existingRequest.generatedDocument.id }
        })
      }

      // 7. Create notifications
      await tx.notification.create({
        data: {
          userId: existingRequest.userId,
          type: 'LEAVE_REQUESTED',
          title: `Leave Request Modified (${updatedRequest.leaveType.name})`,
          message: `Your leave request ${existingRequest.requestNumber} has been modified by HR.`,
          link: '/employee',
        }
      })

      // Notify approvers (informational — no re-approval needed)
      if (existingRequest.approvals.length > 0) {
        for (const approval of existingRequest.approvals) {
          let notificationLink = `/manager?request=${params.id}`
          const approverRole = existingRequest.user.manager?.role
          if (approverRole === 'HR' ||
              (approverRole === 'EMPLOYEE' && (existingRequest.user.manager?.department?.toLowerCase() === 'hr' || existingRequest.user.manager?.department?.toLowerCase() === 'human resources'))) {
            notificationLink = `/hr?request=${params.id}`
          } else if (approverRole === 'EXECUTIVE') {
            notificationLink = `/executive?request=${params.id}`
          }

          await tx.notification.create({
            data: {
              userId: approval.approverId,
              type: 'LEAVE_REQUESTED',
              title: 'Leave Request Modified by HR',
              message: `${existingRequest.user.firstName} ${existingRequest.user.lastName}'s leave request has been modified by HR.`,
              link: notificationLink,
            }
          })
        }
      }

      return updatedRequest
    })

    // Post-transaction: Audit log (non-blocking)
    const newValues = {
      leaveTypeId: newLeaveTypeId,
      leaveTypeName: newLeaveType.name,
      startDate: newStartDate.toISOString(),
      endDate: newEndDate.toISOString(),
      totalDays: newTotalDays,
      reason: newReason,
      status: existingRequest.status,
      substituteIds: substituteIds || oldValues.substituteIds,
    }

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.EDIT_LEAVE,
      entity: 'LEAVE_REQUEST',
      entityId: params.id,
      oldValues,
      newValues,
      metadata: {
        reason: sanitizedEditReason,
        affectedUserId: existingRequest.userId,
      },
    })

    // Post-transaction: Email notification to manager (non-blocking)
    if (existingRequest.user.manager?.email) {
      try {
        await emailService.sendLeaveRequestNotification(existingRequest.user.manager.email, {
          employeeName: `${existingRequest.user.firstName} ${existingRequest.user.lastName}`,
          leaveType: newLeaveType.name,
          startDate: format(newStartDate, 'dd MMMM yyyy'),
          endDate: format(newEndDate, 'dd MMMM yyyy'),
          days: newTotalDays,
          reason: newReason,
          managerName: `${existingRequest.user.manager.firstName} ${existingRequest.user.manager.lastName}`,
          companyName: process.env.COMPANY_NAME || 'TPF',
          requestId: params.id,
        })
      } catch (emailError) {
        console.error('Failed to send manager email for edited request:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Leave request ${existingRequest.requestNumber} updated successfully.`,
      request: result,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('DATE_CONFLICT:')) {
        return NextResponse.json(
          { error: 'Date conflict', message: error.message.replace('DATE_CONFLICT:', '') },
          { status: 409 }
        )
      }
      if (error.message.startsWith('INSUFFICIENT_BALANCE:')) {
        return NextResponse.json(
          { error: error.message.replace('INSUFFICIENT_BALANCE:', '') },
          { status: 400 }
        )
      }
    }
    console.error('Error editing leave request:', error)
    return NextResponse.json(
      { error: 'Failed to edit leave request' },
      { status: 500 }
    )
  }
}
