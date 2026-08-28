import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["MANAGER", "DEPARTMENT_DIRECTOR", "EXECUTIVE", "HR", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10') || 10, 1), 100)
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1)
    const skip = (page - 1) * limit

    const where: Prisma.WorkFromHomeRequestWhereInput = {
      approvals: {
        some: {
          approverId: session.user.id,
          status: 'APPROVED'
        }
      }
    }

    const [approvedRequests, totalCount] = await Promise.all([
      prisma.workFromHomeRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              profileImage: true,
              managerId: true,
            }
          },
          approvals: {
            where: {
              approverId: session.user.id
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.workFromHomeRequest.count({ where })
    ])

    // For requests cancelled after approval, find out who cancelled them so the
    // manager sees "cancelled by employee" rather than a misleading "approved by you".
    const cancelledIds = approvedRequests.filter(r => r.status === 'CANCELLED').map(r => r.id)
    const cancelledBy = new Map<string, 'employee' | 'manager' | 'admin'>()
    if (cancelledIds.length > 0) {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityId: { in: cancelledIds },
          action: { in: ['SELF_CANCEL_REQUEST', 'WFH_APPROVAL_REVOKED', 'REQUEST_CANCELLED'] }
        },
        orderBy: { createdAt: 'desc' },
        select: { entityId: true, action: true }
      })
      for (const log of logs) {
        if (!log.entityId || cancelledBy.has(log.entityId)) continue
        cancelledBy.set(
          log.entityId,
          log.action === 'SELF_CANCEL_REQUEST' ? 'employee'
            : log.action === 'WFH_APPROVAL_REVOKED' ? 'manager'
            : 'admin'
        )
      }
    }

    const formattedRequests = approvedRequests.map(request => {
      const approval = request.approvals[0]
      const overallStatus = request.status === 'APPROVED' ? 'approved' : 'approved_pending_others'

      return {
        id: request.id,
        requestType: 'wfh',
        employee: {
          name: `${request.user?.firstName || ''} ${request.user?.lastName || ''}`.trim() || 'Unknown',
          avatar: request.user?.profileImage || '',
          department: request.user?.department || ''
        },
        type: 'Work From Home',
        dates: `${new Date(request.startDate).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}`,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.totalDays,
        reason: request.location,
        location: request.location,
        submittedDate: request.createdAt.toISOString(),
        approvedDate: approval?.approvedAt?.toISOString() || request.updatedAt.toISOString(),
        substitute: null,
        status: overallStatus,
        overallRequestStatus: request.status,
        cancelledBy: cancelledBy.get(request.id) || null
      }
    })

    return NextResponse.json({
      requests: formattedRequests,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching approved WFH requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
