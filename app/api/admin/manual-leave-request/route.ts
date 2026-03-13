import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'
import { sanitizeComment } from '@/lib/utils/sanitize'
import { emailService } from '@/lib/email-service'
import { eachDayOfInterval, format } from 'date-fns'
import { WorkingDaysService } from '@/lib/services/working-days-service'
import { checkSelectedDatesOverlap, hasActualDateOverlap } from '@/lib/utils/date-validation'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role check: ADMIN, HR
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, firstName: true, lastName: true, email: true }
    })

    if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const data = await request.json()
    const { userId, leaveTypeId, startDate, endDate, totalDays, reason, hrNotes } = data

    // Validate required fields
    if (!userId || !leaveTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, leaveTypeId, startDate, endDate' },
        { status: 400 }
      )
    }

    const parsedTotalDays = parseFloat(totalDays)
    if (isNaN(parsedTotalDays) || parsedTotalDays <= 0) {
      return NextResponse.json({ error: 'totalDays must be a positive number' }, { status: 400 })
    }
    if (parsedTotalDays > 366) {
      return NextResponse.json({ error: 'totalDays cannot exceed 366' }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedReason = reason ? sanitizeComment(String(reason)).slice(0, 2000) : 'Created by Admin'
    const sanitizedHrNotes = hrNotes ? sanitizeComment(String(hrNotes)).slice(0, 1000) : null

    // Verify target user exists and is active, include manager
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, isActive: true, firstName: true, lastName: true, managerId: true,
        manager: { select: { id: true, firstName: true, lastName: true, email: true, role: true, department: true } }
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (!targetUser.isActive) {
      return NextResponse.json({ error: 'Employee is inactive' }, { status: 400 })
    }

    // Verify leave type exists
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
      select: { id: true, name: true, code: true }
    })

    if (!leaveType) {
      return NextResponse.json({ error: 'Leave type not found' }, { status: 404 })
    }

    const parsedStartDate = new Date(startDate)
    const parsedEndDate = new Date(endDate)

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (parsedEndDate < parsedStartDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    // Cap date range to prevent DoS via eachDayOfInterval memory exhaustion
    const daySpan = Math.round((parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daySpan > 366) {
      return NextResponse.json({ error: 'Date range cannot exceed 366 days' }, { status: 400 })
    }

    const balanceYear = parsedStartDate.getFullYear()
    const startDateISO = parsedStartDate.toISOString().split('T')[0]
    const endDateISO = parsedEndDate.toISOString().split('T')[0]

    // Compute working days (selected dates)
    const workingDaysService = WorkingDaysService.getInstance()
    const allDaysInRange = eachDayOfInterval({ start: parsedStartDate, end: parsedEndDate })
    const workingDatesList: Date[] = []
    for (const day of allDaysInRange) {
      if (await workingDaysService.isWorkingDay(day)) {
        workingDatesList.push(day)
      }
    }

    // Pre-transaction overlap check
    const overlapCheck = await checkSelectedDatesOverlap(userId, workingDatesList)
    if (overlapCheck.hasOverlap) {
      return NextResponse.json(
        { error: 'Date conflict', message: overlapCheck.message },
        { status: 409 }
      )
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate request number inside transaction to prevent race conditions
      const currentYear = new Date().getFullYear()
      const requestCount = await tx.leaveRequest.count({
        where: {
          createdAt: {
            gte: new Date(`${currentYear}-01-01`),
          },
        },
      })
      const requestNumber = `LR-${currentYear}-${String(requestCount + 1).padStart(4, '0')}`

      // In-transaction overlap check (race-condition safe)
      const leaveCandidates = await tx.leaveRequest.findMany({
        where: {
          userId,
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: { lte: parsedEndDate },
          endDate: { gte: parsedStartDate },
        },
        select: { id: true, startDate: true, endDate: true, selectedDates: true }
      })

      const incomingRequest = { startDate: parsedStartDate, endDate: parsedEndDate, selectedDates: workingDatesList }
      const overlappingLeave = leaveCandidates.find(c => hasActualDateOverlap(c, incomingRequest))

      if (overlappingLeave) {
        throw new Error(`DATE_CONFLICT:Employee already has a leave request from ${overlappingLeave.startDate.toLocaleDateString()} to ${overlappingLeave.endDate.toLocaleDateString()}. Please choose different dates.`)
      }

      // 1. Create the LeaveRequest — always PENDING
      const leaveRequest = await tx.leaveRequest.create({
        data: {
          requestNumber,
          userId,
          leaveTypeId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          totalDays: parsedTotalDays,
          reason: sanitizedReason,
          status: 'PENDING',
          selectedDates: workingDatesList,
          createdByHrId: session.user.id,
          supportingDocuments: {
            createdByAdmin: true,
            adminUserEmail: currentUser.email,
            ...(sanitizedHrNotes ? { hrNotes: sanitizedHrNotes } : {}),
          },
        },
      })

      // 2. Create Approval record for manager
      if (targetUser.managerId) {
        await tx.approval.create({
          data: {
            leaveRequestId: leaveRequest.id,
            approverId: targetUser.managerId,
            level: 1,
            status: 'PENDING',
            comments: `Created by Admin: ${currentUser.firstName} ${currentUser.lastName}`,
          },
        })
      }

      // 3. Update LeaveBalance: increment pending, decrement available
      const existingBalance = await tx.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId,
            year: balanceYear,
          },
        },
      })

      if (existingBalance) {
        await tx.leaveBalance.update({
          where: {
            userId_leaveTypeId_year: {
              userId,
              leaveTypeId,
              year: balanceYear,
            },
          },
          data: {
            pending: { increment: parsedTotalDays },
            available: { decrement: parsedTotalDays },
          },
        })
      } else {
        await tx.leaveBalance.create({
          data: {
            userId,
            leaveTypeId,
            year: balanceYear,
            entitled: 0,
            used: 0,
            pending: parsedTotalDays,
            available: -parsedTotalDays,
          },
        })
      }

      // 4. Create manager notification (APPROVAL_REQUIRED)
      if (targetUser.managerId) {
        let notificationLink = `/manager?request=${leaveRequest.id}`
        if (targetUser.manager) {
          if (targetUser.manager.role === 'HR' ||
              (targetUser.manager.role === 'EMPLOYEE' && (targetUser.manager.department?.toLowerCase() === 'hr' || targetUser.manager.department?.toLowerCase() === 'human resources'))) {
            notificationLink = `/hr?request=${leaveRequest.id}`
          } else if (targetUser.manager.role === 'EXECUTIVE') {
            notificationLink = `/executive?request=${leaveRequest.id}`
          }
        }

        await tx.notification.create({
          data: {
            userId: targetUser.managerId,
            type: 'APPROVAL_REQUIRED',
            title: 'Leave Request Approval Required',
            message: `${targetUser.firstName} ${targetUser.lastName} has requested ${parsedTotalDays} day(s) of ${leaveType.name} leave (created by Admin)`,
            link: notificationLink,
          },
        })
      }

      // 5. Create employee notification
      await tx.notification.create({
        data: {
          userId,
          type: 'LEAVE_REQUESTED',
          title: `Leave Request Created (${leaveType.name})`,
          message: `A ${leaveType.name} request for ${parsedTotalDays} day(s) from ${startDateISO} to ${endDateISO} has been created by Admin and sent to your manager for approval.`,
          link: '/employee',
        },
      })

      return { leaveRequest, requestNumber }
    })

    // 6. Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.HR_MANUAL_CREATE_LEAVE,
      entity: 'LEAVE_REQUEST',
      entityId: result.leaveRequest.id,
      newValues: {
        requestNumber: result.requestNumber,
        targetUserId: userId,
        targetUserName: `${targetUser.firstName} ${targetUser.lastName}`,
        leaveType: leaveType.name,
        startDate: startDateISO,
        endDate: endDateISO,
        totalDays: parsedTotalDays,
        status: 'PENDING',
        hrNotes: sanitizedHrNotes,
      },
      metadata: {
        reason: `Admin manual leave entry for ${targetUser.firstName} ${targetUser.lastName}`,
        affectedUserId: userId,
      },
    })

    // 7. Send manager email notification (non-blocking)
    if (targetUser.manager?.email) {
      try {
        await emailService.sendLeaveRequestNotification(targetUser.manager.email, {
          employeeName: `${targetUser.firstName} ${targetUser.lastName}`,
          leaveType: leaveType.name,
          startDate: format(parsedStartDate, 'dd MMMM yyyy'),
          endDate: format(parsedEndDate, 'dd MMMM yyyy'),
          days: parsedTotalDays,
          reason: sanitizedReason,
          managerName: `${targetUser.manager.firstName} ${targetUser.manager.lastName}`,
          companyName: process.env.COMPANY_NAME || 'TPF',
          requestId: result.leaveRequest.id,
        })
      } catch (emailError) {
        console.error('Failed to send manager email:', emailError)
      }
    }

    const warningMessage = !targetUser.managerId
      ? 'Warning: Employee has no manager assigned. Request created as pending but no one will be notified for approval.'
      : undefined

    return NextResponse.json({
      success: true,
      message: `Leave request ${result.requestNumber} created successfully${warningMessage ? '. ' + warningMessage : ''}`,
      warning: warningMessage,
      leaveRequest: {
        id: result.leaveRequest.id,
        requestNumber: result.requestNumber,
        status: 'PENDING',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('DATE_CONFLICT:')) {
      return NextResponse.json(
        { error: 'Date conflict', message: error.message.replace('DATE_CONFLICT:', '') },
        { status: 409 }
      )
    }
    console.error('Error creating manual leave request:', error)
    return NextResponse.json(
      { error: 'Failed to create leave request' },
      { status: 500 }
    )
  }
}
