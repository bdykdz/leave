import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'
import { sanitizeComment } from '@/lib/utils/sanitize'
import { emailService } from '@/lib/email-service'
import { format } from 'date-fns'

// PUT: Edit a WFH request (HR/Admin only) — preserves approval status
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
    const { startDate, endDate, totalDays, location, editReason } = body

    if (!editReason || !String(editReason).trim()) {
      return NextResponse.json({ error: 'Edit reason is required' }, { status: 400 })
    }

    const sanitizedEditReason = sanitizeComment(String(editReason)).slice(0, 1000)

    // Fetch existing request with all relations
    const existingRequest = await prisma.workFromHomeRequest.findUnique({
      where: { id: params.id },
      include: {
        user: {
          include: {
            manager: { select: { id: true, firstName: true, lastName: true, email: true, role: true, department: true } },
          }
        },
        approvals: {
          include: { approver: { select: { id: true, firstName: true, lastName: true, email: true } } }
        },
        document: {
          include: { signatures: true }
        },
      }
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'WFH request not found' }, { status: 404 })
    }

    // Validate status
    if (existingRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot edit a cancelled request' }, { status: 400 })
    }

    if (existingRequest.status === 'APPROVED') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (existingRequest.startDate <= today) {
        return NextResponse.json({ error: 'Cannot edit an approved request that has already started' }, { status: 400 })
      }
    }

    // Determine new values (use existing if not provided)
    const newStartDate = startDate ? new Date(startDate) : existingRequest.startDate
    const newEndDate = endDate ? new Date(endDate) : existingRequest.endDate
    const newLocation = location !== undefined ? sanitizeComment(String(location)).slice(0, 200) : existingRequest.location

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

    // Determine totalDays
    let newTotalDays: number
    if (totalDays !== undefined && totalDays !== null) {
      newTotalDays = Math.round(parseFloat(totalDays))
      if (isNaN(newTotalDays) || newTotalDays <= 0) {
        return NextResponse.json({ error: 'totalDays must be a positive number' }, { status: 400 })
      }
    } else {
      newTotalDays = existingRequest.totalDays
    }

    const datesChanged = newStartDate.getTime() !== existingRequest.startDate.getTime() ||
      newEndDate.getTime() !== existingRequest.endDate.getTime() ||
      newTotalDays !== existingRequest.totalDays

    // Store old values for audit
    const oldValues = {
      startDate: existingRequest.startDate.toISOString(),
      endDate: existingRequest.endDate.toISOString(),
      totalDays: existingRequest.totalDays,
      location: existingRequest.location,
      status: existingRequest.status,
    }

    // Execute everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // In-transaction overlap check (race-condition safe)
      const wfhCandidates = await tx.workFromHomeRequest.findMany({
        where: {
          userId: existingRequest.userId,
          status: { in: ['APPROVED', 'PENDING'] },
          id: { not: existingRequest.id },
          startDate: { lte: newEndDate },
          endDate: { gte: newStartDate },
        },
        select: { id: true, startDate: true, endDate: true }
      })

      if (wfhCandidates.length > 0) {
        const overlap = wfhCandidates[0]
        throw new Error(`DATE_CONFLICT:Employee already has a WFH request from ${overlap.startDate.toLocaleDateString()} to ${overlap.endDate.toLocaleDateString()}. Please choose different dates.`)
      }

      // Also check leave request overlaps
      const leaveCandidates = await tx.leaveRequest.findMany({
        where: {
          userId: existingRequest.userId,
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: { lte: newEndDate },
          endDate: { gte: newStartDate },
        },
        select: { id: true, startDate: true, endDate: true }
      })

      if (leaveCandidates.length > 0) {
        const overlap = leaveCandidates[0]
        throw new Error(`DATE_CONFLICT:Employee already has a leave request from ${overlap.startDate.toLocaleDateString()} to ${overlap.endDate.toLocaleDateString()}. Please choose different dates.`)
      }

      // Update the WFH request — preserve status
      const updatedRequest = await tx.workFromHomeRequest.update({
        where: { id: params.id },
        data: {
          startDate: newStartDate,
          endDate: newEndDate,
          totalDays: newTotalDays,
          location: newLocation,
          status: existingRequest.status,
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
        }
      })

      // Delete WFH document if dates changed
      if (datesChanged && existingRequest.document) {
        await tx.wFHSignature.deleteMany({
          where: { documentId: existingRequest.document.id }
        })
        await tx.wFHDocument.delete({
          where: { id: existingRequest.document.id }
        })
      }

      // Notify employee
      await tx.notification.create({
        data: {
          userId: existingRequest.userId,
          type: 'LEAVE_REQUESTED',
          title: 'WFH Request Modified',
          message: `Your WFH request ${existingRequest.requestNumber} has been modified by HR.`,
          link: '/employee',
        }
      })

      // Notify approvers (informational)
      for (const approval of existingRequest.approvals) {
        let notificationLink = `/manager?request=${params.id}`
        const managerRole = existingRequest.user.manager?.role
        if (managerRole === 'HR' ||
            (managerRole === 'EMPLOYEE' && (existingRequest.user.manager?.department?.toLowerCase() === 'hr' || existingRequest.user.manager?.department?.toLowerCase() === 'human resources'))) {
          notificationLink = `/hr?request=${params.id}`
        } else if (managerRole === 'EXECUTIVE') {
          notificationLink = `/executive?request=${params.id}`
        }

        await tx.notification.create({
          data: {
            userId: approval.approverId,
            type: 'LEAVE_REQUESTED',
            title: 'WFH Request Modified by HR',
            message: `${existingRequest.user.firstName} ${existingRequest.user.lastName}'s WFH request has been modified by HR.`,
            link: notificationLink,
          }
        })
      }

      return updatedRequest
    })

    // Post-transaction: Audit log (non-blocking)
    const newValues = {
      startDate: newStartDate.toISOString(),
      endDate: newEndDate.toISOString(),
      totalDays: newTotalDays,
      location: newLocation,
      status: existingRequest.status,
    }

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.EDIT_WFH,
      entity: 'WFH_REQUEST',
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
        await emailService.sendWFHRequestNotification(existingRequest.user.manager.email, {
          employeeName: `${existingRequest.user.firstName} ${existingRequest.user.lastName}`,
          startDate: format(newStartDate, 'dd MMMM yyyy'),
          endDate: format(newEndDate, 'dd MMMM yyyy'),
          days: newTotalDays,
          location: newLocation,
          managerName: `${existingRequest.user.manager.firstName} ${existingRequest.user.manager.lastName}`,
          requestId: params.id,
        })
      } catch (emailError) {
        console.error('Failed to send manager email for edited WFH request:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `WFH request ${existingRequest.requestNumber} updated successfully.`,
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
    }
    console.error('Error editing WFH request:', error)
    return NextResponse.json(
      { error: 'Failed to edit WFH request' },
      { status: 500 }
    )
  }
}
