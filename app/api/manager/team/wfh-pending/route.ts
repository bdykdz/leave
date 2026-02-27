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
      status: 'PENDING',
      OR: [
        {
          approvals: {
            some: {
              approverId: session.user.id,
              status: 'PENDING'
            }
          }
        },
        {
          user: {
            managerId: session.user.id
          }
        }
      ]
    }

    const [pendingWFHRequests, totalCount] = await Promise.all([
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
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.workFromHomeRequest.count({ where })
    ])

    const formattedRequests = pendingWFHRequests.map(request => ({
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
      substitute: null,
      status: 'pending'
    }))

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
    console.error("Error fetching pending WFH requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
