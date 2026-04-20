import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { createAuditLog, AuditAction } from '@/lib/utils/audit-log'

// POST: Cancel a WFH request (HR/Admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    let reason: string | undefined
    try {
      const body = await request.json()
      reason = body?.reason
    } catch {
      reason = undefined
    }

    const wfhRequest = await prisma.workFromHomeRequest.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { firstName: true, lastName: true } },
        approvals: true,
      }
    })

    if (!wfhRequest) {
      return NextResponse.json({ error: 'WFH request not found' }, { status: 404 })
    }

    if (wfhRequest.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Request is already cancelled' }, { status: 400 })
    }

    if (wfhRequest.status === 'APPROVED') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (wfhRequest.startDate <= today) {
        return NextResponse.json({ error: 'Cannot cancel an approved request that has already started' }, { status: 400 })
      }
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.workFromHomeRequest.update({
        where: { id: params.id },
        data: { status: 'CANCELLED' }
      })

      await tx.wFHApproval.updateMany({
        where: { wfhRequestId: params.id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          comments: reason || 'Cancelled by HR',
          approvedAt: new Date(),
        }
      })

      await tx.notification.create({
        data: {
          userId: wfhRequest.userId,
          type: 'LEAVE_REQUESTED',
          title: 'WFH Request Cancelled',
          message: `Your WFH request ${wfhRequest.requestNumber} has been cancelled by HR.${reason ? ` Reason: ${reason}` : ''}`,
          link: '/employee',
        }
      })

      return cancelled
    })

    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.REJECT_WFH,
      entity: 'WFH_REQUEST',
      entityId: params.id,
      oldValues: { status: wfhRequest.status },
      newValues: { status: 'CANCELLED' },
      metadata: {
        reason: reason || 'Cancelled by HR',
        affectedUserId: wfhRequest.userId,
      },
    })

    return NextResponse.json({
      message: 'WFH request cancelled successfully',
      request: updatedRequest,
    })
  } catch (error) {
    console.error('Error cancelling WFH request:', error)
    return NextResponse.json(
      { error: 'Failed to cancel WFH request' },
      { status: 500 }
    )
  }
}
