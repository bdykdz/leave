import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'
import { sanitizeComment } from '@/lib/utils/sanitize'
import { WorkingDaysService } from '@/lib/services/working-days-service'
import { eachDayOfInterval } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role check: HR, ADMIN, EXECUTIVE
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, firstName: true, lastName: true, email: true }
    })

    if (!currentUser || !['HR', 'ADMIN', 'EXECUTIVE'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const {
      userId,
      leaveTypeId,
      startDate,
      endDate,
      totalDays,
      reason,
      status,
      hrNotes,
    } = body

    // Validate required fields (explicit null/undefined check — don't reject totalDays=0 via falsy)
    if (!userId || !leaveTypeId || !startDate || !endDate || totalDays === undefined || totalDays === null || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, leaveTypeId, startDate, endDate, totalDays, reason' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['APPROVED', 'PENDING']
    const requestStatus = validStatuses.includes(status) ? status : 'APPROVED'

    // Validate totalDays is a positive number
    const parsedTotalDays = parseFloat(totalDays)
    if (isNaN(parsedTotalDays) || parsedTotalDays <= 0) {
      return NextResponse.json({ error: 'totalDays must be a positive number' }, { status: 400 })
    }

    // Sanitize string inputs — strip HTML, trim, cap length
    const sanitizedReason = sanitizeComment(String(reason)).slice(0, 2000)
    const sanitizedHrNotes = hrNotes ? sanitizeComment(String(hrNotes)).slice(0, 1000) : null

    if (!sanitizedReason) {
      return NextResponse.json({ error: 'Reason cannot be empty' }, { status: 400 })
    }

    // Verify target user exists and is active
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, firstName: true, lastName: true }
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

    // Balance year from startDate, not current year
    const balanceYear = parsedStartDate.getFullYear()
    const startDateISO = parsedStartDate.toISOString().split('T')[0]
    const endDateISO = parsedEndDate.toISOString().split('T')[0]

    // Compute working days (selected dates) for document generation
    const workingDaysService = WorkingDaysService.getInstance()
    const allDaysInRange = eachDayOfInterval({ start: parsedStartDate, end: parsedEndDate })
    const workingDatesList: Date[] = []
    for (const day of allDaysInRange) {
      if (await workingDaysService.isWorkingDay(day)) {
        workingDatesList.push(day)
      }
    }

    // Execute everything in a transaction (including request number generation to prevent duplicates)
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

      // 1. Create the LeaveRequest with only valid schema fields
      const leaveRequest = await tx.leaveRequest.create({
        data: {
          requestNumber,
          userId,
          leaveTypeId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          totalDays: parsedTotalDays,
          reason: sanitizedReason,
          status: requestStatus,
          selectedDates: workingDatesList,
          createdByHrId: session.user.id,
          supportingDocuments: {
            createdByHr: true,
            hrUserEmail: currentUser.email,
            ...(sanitizedHrNotes ? { hrNotes: sanitizedHrNotes } : {}),
          },
        },
      })

      // 2. Create Approval record if APPROVED
      if (requestStatus === 'APPROVED') {
        await tx.approval.create({
          data: {
            leaveRequestId: leaveRequest.id,
            approverId: session.user.id,
            level: 1,
            status: 'APPROVED',
            comments: `Manual entry by HR: ${currentUser.firstName} ${currentUser.lastName}`,
            approvedAt: new Date(),
          },
        })

        // Update LeaveBalance: increment used, decrement available
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
              used: { increment: parsedTotalDays },
              available: { decrement: parsedTotalDays },
            },
          })
        } else {
          // Create balance record if missing (upsert pattern)
          await tx.leaveBalance.create({
            data: {
              userId,
              leaveTypeId,
              year: balanceYear,
              entitled: 0,
              used: parsedTotalDays,
              pending: 0,
              available: -parsedTotalDays, // Will be negative — HR sees real state
            },
          })
        }
      } else if (requestStatus === 'PENDING') {
        // Update LeaveBalance: increment pending, decrement available
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
      }

      // 3. Create Notification for employee
      await tx.notification.create({
        data: {
          userId,
          type: requestStatus === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REQUESTED',
          title: requestStatus === 'APPROVED'
            ? `Leave Request Approved (${leaveType.name})`
            : `Leave Request Created (${leaveType.name})`,
          message: requestStatus === 'APPROVED'
            ? `A ${leaveType.name} request for ${parsedTotalDays} day(s) from ${startDateISO} to ${endDateISO} has been created and approved by HR.`
            : `A ${leaveType.name} request for ${parsedTotalDays} day(s) from ${startDateISO} to ${endDateISO} has been created by HR.`,
          link: '/employee',
        },
      })

      return { leaveRequest, requestNumber }
    })

    // 4. Create audit log (outside transaction — should not break main flow)
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
        status: requestStatus,
        hrNotes: sanitizedHrNotes,
      },
      metadata: {
        reason: `HR manual leave entry for ${targetUser.firstName} ${targetUser.lastName}`,
        affectedUserId: userId,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Leave request ${result.requestNumber} created successfully`,
      leaveRequest: {
        id: result.leaveRequest.id,
        requestNumber: result.requestNumber,
        status: requestStatus,
      },
    })
  } catch (error) {
    console.error('Error creating manual leave request:', error)
    return NextResponse.json(
      { error: 'Failed to create leave request' },
      { status: 500 }
    )
  }
}
