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

    if (!["MANAGER", "DEPARTMENT_DIRECTOR", "EXECUTIVE", "HR", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10') || 10, 1), 100)
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1)
    const skip = (page - 1) * limit

    const where = {
      approvals: {
        some: {
          approverId: session.user.id,
          status: 'REJECTED' as const
        }
      }
    }

    const [deniedRequests, totalCount] = await Promise.all([
      prisma.workTripRequest.findMany({
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
      prisma.workTripRequest.count({ where })
    ])

    const formattedRequests = deniedRequests.map(request => {
      const approval = request.approvals[0]
      return {
        id: request.id,
        requestType: 'workTrip',
        employee: {
          name: `${request.user?.firstName || ''} ${request.user?.lastName || ''}`.trim() || 'Unknown',
          avatar: (request.user as any)?.image || '',
          department: request.user?.department || ''
        },
        type: 'Work Trip',
        dates: `${new Date(request.startDate).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}`,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.totalDays,
        reason: request.purpose,
        destination: request.destination,
        purpose: request.purpose,
        submittedDate: request.createdAt.toISOString(),
        deniedDate: approval?.approvedAt?.toISOString() || request.updatedAt.toISOString(),
        denialReason: approval?.comments || '',
        substitute: null,
        status: 'denied'
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
    console.error("Error fetching denied work trip requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
