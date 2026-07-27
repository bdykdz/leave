import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

const MANAGER_ROLES = ['MANAGER', 'DEPARTMENT_DIRECTOR', 'EXECUTIVE']
const DIRECTOR_ROLES = ['DEPARTMENT_DIRECTOR', 'EXECUTIVE']

// POST: bulk-move selected reports from this user (the outgoing manager) to a new
// manager, optionally rerouting the outgoing manager's PENDING approvals on those
// reports' requests so nothing stays stuck in their queue.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId: oldManagerId } = await params
    const body = await request.json()
    const newManagerId: string = body.newManagerId
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : []
    const reroutePendingApprovals: boolean = body.reroutePendingApprovals !== false

    if (!newManagerId || userIds.length === 0) {
      return NextResponse.json(
        { error: 'newManagerId and a non-empty userIds list are required' },
        { status: 400 }
      )
    }

    if (newManagerId === oldManagerId) {
      return NextResponse.json(
        { error: 'New manager must be different from the outgoing manager' },
        { status: 400 }
      )
    }

    const [oldManager, newManager] = await Promise.all([
      prisma.user.findUnique({
        where: { id: oldManagerId },
        select: { id: true, firstName: true, lastName: true }
      }),
      prisma.user.findUnique({
        where: { id: newManagerId },
        select: { id: true, firstName: true, lastName: true, role: true, isActive: true }
      })
    ])

    if (!oldManager) {
      return NextResponse.json({ error: 'Outgoing manager not found' }, { status: 404 })
    }
    if (!newManager) {
      return NextResponse.json({ error: 'New manager not found' }, { status: 400 })
    }
    if (!newManager.isActive) {
      return NextResponse.json({ error: 'New manager is inactive' }, { status: 400 })
    }
    if (!MANAGER_ROLES.includes(newManager.role)) {
      return NextResponse.json(
        { error: 'Selected user cannot be a manager (must be MANAGER, DEPARTMENT_DIRECTOR or EXECUTIVE)' },
        { status: 400 }
      )
    }

    const newManagerCanBeDirector = DIRECTOR_ROLES.includes(newManager.role)

    // Only touch users who actually report to the outgoing manager. If the new
    // manager is among the selected reports (promoted from within the team),
    // they are skipped — a user cannot be their own manager.
    const targets = await prisma.user.findMany({
      where: {
        id: { in: userIds.filter(id => id !== newManagerId) },
        OR: [{ managerId: oldManagerId }, { departmentDirectorId: oldManagerId }]
      },
      select: { id: true, firstName: true, lastName: true, managerId: true, departmentDirectorId: true }
    })

    if (targets.length === 0) {
      return NextResponse.json(
        { error: 'None of the selected users report to the outgoing manager' },
        { status: 400 }
      )
    }

    const targetIds = targets.map(t => t.id)
    const summary = {
      managerReassigned: 0,
      directorReassigned: 0,
      directorSkipped: [] as string[],
      promotedSkipped: userIds.includes(newManagerId),
      rerouted: { leave: 0, wfh: 0, workTrip: 0 },
      rerouteConflicts: 0
    }

    // Pre-fetch pending approvals outside the transaction (reads only).
    const [leaveApprovals, wfhApprovals, workTripApprovals] = reroutePendingApprovals
      ? await Promise.all([
          prisma.approval.findMany({
            where: {
              approverId: oldManagerId,
              status: 'PENDING',
              escalatedToId: null,
              leaveRequest: { status: 'PENDING', userId: { in: targetIds } }
            },
            include: {
              leaveRequest: {
                select: {
                  id: true,
                  user: { select: { firstName: true, lastName: true } },
                  approvals: { select: { approverId: true, status: true } }
                }
              }
            }
          }),
          prisma.wFHApproval.findMany({
            where: {
              approverId: oldManagerId,
              status: 'PENDING',
              wfhRequest: { status: 'PENDING', userId: { in: targetIds } }
            },
            include: {
              wfhRequest: { select: { id: true, approvals: { select: { approverId: true } } } }
            }
          }),
          prisma.workTripApproval.findMany({
            where: {
              approverId: oldManagerId,
              status: 'PENDING',
              workTripRequest: { status: 'PENDING', userId: { in: targetIds } }
            },
            include: {
              workTripRequest: { select: { id: true, approvals: { select: { approverId: true } } } }
            }
          })
        ])
      : [[], [], []]

    const rerouteReason = `Manager change: team reassigned from ${oldManager.firstName} ${oldManager.lastName} to ${newManager.firstName} ${newManager.lastName} by admin`

    await prisma.$transaction(async (tx) => {
      // 1. Repoint manager / department director on each selected report
      for (const target of targets) {
        const data: { managerId?: string; departmentDirectorId?: string } = {}
        if (target.managerId === oldManagerId) {
          data.managerId = newManagerId
          summary.managerReassigned++
        }
        if (target.departmentDirectorId === oldManagerId) {
          if (newManagerCanBeDirector) {
            data.departmentDirectorId = newManagerId
            summary.directorReassigned++
          } else {
            summary.directorSkipped.push(`${target.firstName} ${target.lastName}`)
          }
        }
        if (Object.keys(data).length > 0) {
          await tx.user.update({ where: { id: target.id }, data })
        }
      }

      // 2. Reroute pending leave approvals using the escalation mechanism, so the
      // approval-order guard treats the outgoing manager's level as bypassed.
      for (const approval of leaveApprovals) {
        const alreadyAssigned = approval.leaveRequest.approvals.some(
          a => a.approverId === newManagerId && a.status === 'PENDING'
        )
        if (alreadyAssigned) {
          summary.rerouteConflicts++
          continue
        }

        await tx.approval.update({
          where: { id: approval.id },
          data: {
            escalatedToId: newManagerId,
            escalatedAt: new Date(),
            escalationReason: rerouteReason
          }
        })

        const created = await tx.approval.create({
          data: {
            leaveRequestId: approval.leaveRequestId,
            approverId: newManagerId,
            level: approval.level + 1,
            status: 'PENDING',
            comments: `Rerouted from ${oldManager.firstName} ${oldManager.lastName} (manager change)`
          }
        })

        await tx.notification.create({
          data: {
            userId: newManagerId,
            type: 'APPROVAL_REQUIRED',
            title: 'Approval required (rerouted)',
            message: `The leave request of ${approval.leaveRequest.user.firstName} ${approval.leaveRequest.user.lastName} was rerouted to you following a manager change.`,
            link: `/leave-requests/${approval.leaveRequestId}`
          }
        })

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'APPROVAL_REROUTED',
            entity: 'APPROVAL',
            entityId: created.id,
            oldValues: { approverId: oldManagerId, level: approval.level },
            newValues: { approverId: newManagerId, level: approval.level + 1, reason: rerouteReason }
          }
        })

        summary.rerouted.leave++
      }

      // 3. WFH / work-trip approvals have no escalation fields — swap the approver
      // on the pending row directly (skip if the new manager already has a row,
      // the unique constraint would be violated).
      for (const approval of wfhApprovals) {
        if (approval.wfhRequest.approvals.some(a => a.approverId === newManagerId)) {
          summary.rerouteConflicts++
          continue
        }
        await tx.wFHApproval.update({
          where: { id: approval.id },
          data: { approverId: newManagerId }
        })
        summary.rerouted.wfh++
      }

      for (const approval of workTripApprovals) {
        if (approval.workTripRequest.approvals.some(a => a.approverId === newManagerId)) {
          summary.rerouteConflicts++
          continue
        }
        await tx.workTripApproval.update({
          where: { id: approval.id },
          data: { approverId: newManagerId }
        })
        summary.rerouted.workTrip++
      }

      // 4. One summary audit entry for the whole transfer
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'TEAM_REASSIGNED',
          entity: 'USER',
          entityId: oldManagerId,
          oldValues: { managerId: oldManagerId },
          newValues: {
            managerId: newManagerId,
            reassignedUserIds: targetIds,
            summary: JSON.parse(JSON.stringify(summary))
          }
        }
      })
    }, { timeout: 30000 })

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('Error reassigning team:', error)
    return NextResponse.json({ error: 'Failed to reassign team' }, { status: 500 })
  }
}
