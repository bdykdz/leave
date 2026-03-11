import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'
import { sanitizeComment } from '@/lib/utils/sanitize'
import { emailService } from '@/lib/email-service'
import { format } from 'date-fns'

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
    const { userId, startDate, endDate, totalDays, location, hrNotes } = data

    // Validate required fields
    if (!userId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, startDate, endDate' },
        { status: 400 }
      )
    }

    // totalDays is Int on WFH model — round to nearest integer
    const parsedTotalDays = Math.round(parseFloat(totalDays) || 1)
    if (parsedTotalDays <= 0) {
      return NextResponse.json({ error: 'totalDays must be a positive number' }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedLocation = location ? sanitizeComment(String(location)).slice(0, 200) : 'home'
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

    // Execute in transaction
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

      // 1. Create WFH request — always PENDING
      const wfhRequest = await tx.workFromHomeRequest.create({
        data: {
          requestNumber,
          userId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          totalDays: parsedTotalDays,
          location: sanitizedLocation,
          status: 'PENDING',
          createdByHrId: session.user.id,
          selectedDates: Prisma.JsonNull,
        },
      })

      // 2. Create WFHApproval record for manager
      if (targetUser.managerId) {
        await tx.wFHApproval.create({
          data: {
            wfhRequestId: wfhRequest.id,
            approverId: targetUser.managerId,
            status: 'PENDING',
          },
        })
      }

      // 3. Create manager notification (APPROVAL_REQUIRED)
      if (targetUser.managerId) {
        let notificationLink = `/manager?request=${wfhRequest.id}`
        if (targetUser.manager) {
          if (targetUser.manager.role === 'HR' ||
              (targetUser.manager.role === 'EMPLOYEE' && (targetUser.manager.department?.toLowerCase() === 'hr' || targetUser.manager.department?.toLowerCase() === 'human resources'))) {
            notificationLink = `/hr?request=${wfhRequest.id}`
          } else if (targetUser.manager.role === 'EXECUTIVE') {
            notificationLink = `/executive?request=${wfhRequest.id}`
          }
        }

        await tx.notification.create({
          data: {
            userId: targetUser.managerId,
            type: 'APPROVAL_REQUIRED',
            title: 'WFH Request Approval Required',
            message: `${targetUser.firstName} ${targetUser.lastName} has requested ${parsedTotalDays} day(s) of work from home (created by Admin)`,
            link: notificationLink,
          },
        })
      }

      // 4. Create employee notification
      await tx.notification.create({
        data: {
          userId,
          type: 'LEAVE_REQUESTED',
          title: 'Work From Home Request Created',
          message: `A WFH request for ${parsedTotalDays} day(s) from ${startDateISO} to ${endDateISO} has been created by Admin and sent to your manager for approval.`,
          link: '/employee',
        },
      })

      return { wfhRequest, requestNumber }
    })

    // 5. Create audit log
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
        status: 'PENDING',
        hrNotes: sanitizedHrNotes,
      },
      metadata: {
        reason: `Admin manual WFH entry for ${targetUser.firstName} ${targetUser.lastName}`,
        affectedUserId: userId,
      },
    })

    // 6. Send manager email notification (non-blocking)
    if (targetUser.manager?.email) {
      try {
        await emailService.sendWFHRequestNotification(targetUser.manager.email, {
          employeeName: `${targetUser.firstName} ${targetUser.lastName}`,
          startDate: format(parsedStartDate, 'dd MMMM yyyy'),
          endDate: format(parsedEndDate, 'dd MMMM yyyy'),
          days: parsedTotalDays,
          location: sanitizedLocation,
          managerName: `${targetUser.manager.firstName} ${targetUser.manager.lastName}`,
          requestId: result.wfhRequest.id,
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
      message: `WFH request ${result.requestNumber} created successfully${warningMessage ? '. ' + warningMessage : ''}`,
      warning: warningMessage,
      wfhRequest: {
        id: result.wfhRequest.id,
        requestNumber: result.requestNumber,
        status: 'PENDING',
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
