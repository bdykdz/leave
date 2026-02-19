import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'
import { sanitizeComment } from '@/lib/utils/sanitize'

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
      startDate,
      endDate,
      totalDays,
      location,
      status,
      hrNotes,
    } = body

    // Validate required fields (explicit null/undefined check — don't reject totalDays=0 via falsy)
    if (!userId || !startDate || !endDate || totalDays === undefined || totalDays === null) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, startDate, endDate, totalDays' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['APPROVED', 'PENDING']
    const requestStatus = validStatuses.includes(status) ? status : 'APPROVED'

    // totalDays is Int on WFH model — round to nearest integer
    const parsedTotalDays = Math.round(parseFloat(totalDays))
    if (isNaN(parsedTotalDays) || parsedTotalDays <= 0) {
      return NextResponse.json({ error: 'totalDays must be a positive number' }, { status: 400 })
    }

    // Sanitize string inputs — strip HTML, trim, cap length
    const sanitizedLocation = location ? sanitizeComment(String(location)).slice(0, 200) : 'home'
    const sanitizedHrNotes = hrNotes ? sanitizeComment(String(hrNotes)).slice(0, 1000) : null

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

    const parsedStartDate = new Date(startDate)
    const parsedEndDate = new Date(endDate)

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (parsedEndDate < parsedStartDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    const startDateISO = parsedStartDate.toISOString().split('T')[0]
    const endDateISO = parsedEndDate.toISOString().split('T')[0]

    // Execute in transaction (including request number generation to prevent duplicates)
    const result = await prisma.$transaction(async (tx) => {
      // Generate request number inside transaction to prevent race conditions
      const currentYear = new Date().getFullYear()
      const requestCount = await tx.workFromHomeRequest.count({
        where: {
          createdAt: {
            gte: new Date(`${currentYear}-01-01`),
          },
        },
      })
      const requestNumber = `WFH-${currentYear}-${String(requestCount + 1).padStart(4, '0')}`

      // 1. Create WFH request with valid schema fields
      // Don't abuse selectedDates for metadata — leave it null
      const wfhRequest = await tx.workFromHomeRequest.create({
        data: {
          requestNumber,
          userId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          totalDays: parsedTotalDays,
          location: sanitizedLocation,
          status: requestStatus,
          createdByHrId: session.user.id,
          selectedDates: Prisma.JsonNull,
        },
      })

      // 2. Create WFHApproval record if APPROVED
      if (requestStatus === 'APPROVED') {
        await tx.wFHApproval.create({
          data: {
            wfhRequestId: wfhRequest.id,
            approverId: session.user.id,
            status: 'APPROVED',
            comments: sanitizedHrNotes
              ? `Manual entry by HR: ${currentUser.firstName} ${currentUser.lastName} — ${sanitizedHrNotes}`
              : `Manual entry by HR: ${currentUser.firstName} ${currentUser.lastName}`,
            approvedAt: new Date(),
          },
        })
      }

      // 3. Create Notification for employee
      await tx.notification.create({
        data: {
          userId,
          type: requestStatus === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REQUESTED',
          title: requestStatus === 'APPROVED'
            ? 'Work From Home Request Approved'
            : 'Work From Home Request Created',
          message: requestStatus === 'APPROVED'
            ? `A WFH request for ${parsedTotalDays} day(s) from ${startDateISO} to ${endDateISO} has been created and approved by HR.`
            : `A WFH request for ${parsedTotalDays} day(s) from ${startDateISO} to ${endDateISO} has been created by HR.`,
          link: '/employee',
        },
      })

      return { wfhRequest, requestNumber }
    })

    // 4. Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.HR_MANUAL_CREATE_WFH,
      entity: 'WFH_REQUEST',
      entityId: result.wfhRequest.id,
      newValues: {
        requestNumber: result.requestNumber,
        targetUserId: userId,
        targetUserName: `${targetUser.firstName} ${targetUser.lastName}`,
        startDate: startDateISO,
        endDate: endDateISO,
        totalDays: parsedTotalDays,
        location: sanitizedLocation,
        status: requestStatus,
        hrNotes: sanitizedHrNotes,
      },
      metadata: {
        reason: `HR manual WFH entry for ${targetUser.firstName} ${targetUser.lastName}`,
        affectedUserId: userId,
      },
    })

    return NextResponse.json({
      success: true,
      message: `WFH request ${result.requestNumber} created successfully`,
      wfhRequest: {
        id: result.wfhRequest.id,
        requestNumber: result.requestNumber,
        status: requestStatus,
      },
    })
  } catch (error) {
    console.error('Error creating manual WFH request:', error)
    return NextResponse.json(
      { error: 'Failed to create WFH request' },
      { status: 500 }
    )
  }
}
