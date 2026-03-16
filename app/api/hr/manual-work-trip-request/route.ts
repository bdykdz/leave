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
      destination,
      purpose,
      hrNotes,
    } = body

    if (!userId || !startDate || !endDate || totalDays === undefined || totalDays === null) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, startDate, endDate, totalDays' },
        { status: 400 }
      )
    }

    if (!destination) {
      return NextResponse.json({ error: 'Destination is required' }, { status: 400 })
    }

    if (!purpose) {
      return NextResponse.json({ error: 'Purpose is required' }, { status: 400 })
    }

    const requestStatus = 'PENDING'

    const parsedTotalDays = Math.round(parseFloat(totalDays))
    if (isNaN(parsedTotalDays) || parsedTotalDays <= 0) {
      return NextResponse.json({ error: 'totalDays must be a positive number' }, { status: 400 })
    }
    if (parsedTotalDays > 366) {
      return NextResponse.json({ error: 'totalDays cannot exceed 366' }, { status: 400 })
    }

    const sanitizedDestination = sanitizeComment(String(destination)).slice(0, 200)
    const sanitizedPurpose = sanitizeComment(String(purpose)).slice(0, 1000)
    const sanitizedHrNotes = hrNotes ? sanitizeComment(String(hrNotes)).slice(0, 1000) : null

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

    const result = await prisma.$transaction(async (tx) => {
      const currentYear = new Date().getFullYear()
      const requestCount = await tx.workTripRequest.count({
        where: {
          createdAt: {
            gte: new Date(`${currentYear}-01-01`),
          },
        },
      })
      const requestNumber = `WT-${currentYear}-${String(requestCount + 1).padStart(4, '0')}`

      const workTripRequest = await tx.workTripRequest.create({
        data: {
          requestNumber,
          userId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          totalDays: parsedTotalDays,
          destination: sanitizedDestination,
          purpose: sanitizedPurpose,
          status: requestStatus,
          createdByHrId: session.user.id,
          selectedDates: Prisma.JsonNull,
        },
      })

      if (targetUser.managerId) {
        await tx.workTripApproval.create({
          data: {
            workTripRequestId: workTripRequest.id,
            approverId: targetUser.managerId,
            status: 'PENDING',
          },
        })
      }

      if (targetUser.managerId) {
        let notificationLink = `/manager?request=${workTripRequest.id}`
        if (targetUser.manager) {
          if (targetUser.manager.role === 'HR' ||
              (targetUser.manager.role === 'EMPLOYEE' && (targetUser.manager.department?.toLowerCase() === 'hr' || targetUser.manager.department?.toLowerCase() === 'human resources'))) {
            notificationLink = `/hr?request=${workTripRequest.id}`
          } else if (targetUser.manager.role === 'EXECUTIVE') {
            notificationLink = `/executive?request=${workTripRequest.id}`
          }
        }

        await tx.notification.create({
          data: {
            userId: targetUser.managerId,
            type: 'APPROVAL_REQUIRED',
            title: 'Work Trip Request Approval Required',
            message: `${targetUser.firstName} ${targetUser.lastName} has requested a ${parsedTotalDays} day(s) work trip to ${sanitizedDestination} (created by HR)`,
            link: notificationLink,
          },
        })
      }

      await tx.notification.create({
        data: {
          userId,
          type: 'LEAVE_REQUESTED',
          title: 'Work Trip Request Created',
          message: `A work trip request for ${parsedTotalDays} day(s) from ${startDateISO} to ${endDateISO} to ${sanitizedDestination} has been created by HR and sent to your manager for approval.`,
          link: '/employee',
        },
      })

      return { workTripRequest, requestNumber }
    })

    if (targetUser.manager?.email) {
      try {
        await emailService.sendWorkTripRequestNotification(targetUser.manager.email, {
          employeeName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
          startDate: format(parsedStartDate, 'dd MMMM yyyy'),
          endDate: format(parsedEndDate, 'dd MMMM yyyy'),
          days: parsedTotalDays,
          destination: sanitizedDestination,
          purpose: sanitizedPurpose,
          managerName: `${targetUser.manager.firstName || ''} ${targetUser.manager.lastName || ''}`.trim(),
          requestId: result.workTripRequest.id,
        })
      } catch (emailError) {
        console.error('Failed to send manager email:', emailError)
      }
    }

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.HR_MANUAL_CREATE_WORK_TRIP,
      entity: 'WORK_TRIP_REQUEST',
      entityId: result.workTripRequest.id,
      newValues: {
        requestNumber: result.requestNumber,
        targetUserId: userId,
        targetUserName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
        startDate: startDateISO,
        endDate: endDateISO,
        totalDays: parsedTotalDays,
        destination: sanitizedDestination,
        purpose: sanitizedPurpose,
        status: requestStatus,
        hrNotes: sanitizedHrNotes,
      },
      metadata: {
        reason: `HR manual work trip entry for ${targetUser.firstName} ${targetUser.lastName}`,
        affectedUserId: userId,
      },
    })

    const warningMessage = !targetUser.managerId
      ? 'Warning: Employee has no manager assigned. Request created as pending but no one will be notified for approval.'
      : undefined

    return NextResponse.json({
      success: true,
      message: `Work trip request ${result.requestNumber} created successfully${warningMessage ? '. ' + warningMessage : ''}`,
      warning: warningMessage,
      workTripRequest: {
        id: result.workTripRequest.id,
        requestNumber: result.requestNumber,
        status: 'PENDING',
      },
    })
  } catch (error) {
    console.error('Error creating manual work trip request:', error)
    return NextResponse.json(
      { error: 'Failed to create work trip request' },
      { status: 500 }
    )
  }
}
