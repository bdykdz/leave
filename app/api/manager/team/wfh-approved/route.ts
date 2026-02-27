import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["MANAGER", "DEPARTMENT_DIRECTOR", "EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where = {
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
          user: true,
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

    const formattedRequests = approvedRequests.map(request => {
      const approval = request.approvals[0]
      const overallStatus = request.status === 'APPROVED' ? 'approved' : 'approved_pending_others'

      return {
        id: request.id,
        requestType: 'wfh',
        employee: {
          name: `${request.user?.firstName || ''} ${request.user?.lastName || ''}`.trim() || 'Unknown',
          avatar: request.user?.image || '',
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
        overallRequestStatus: request.status
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
