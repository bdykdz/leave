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

    // Check if user is a manager
    if (!["MANAGER", "DEPARTMENT_DIRECTOR", "EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Get pending requests from team members
    const pendingRequests = await prisma.leaveRequest.findMany({
      where: {
        user: {
          managerId: session.user.id
        },
        status: 'PENDING',
        approvals: {
          some: {
            approverId: session.user.id,
            status: 'PENDING'
          }
        }
      },
      include: {
        user: true,
        leaveType: true,
        substitute: {
          select: {
            firstName: true,
            lastName: true
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
    })

    // Get total count for pagination
    const totalCount = await prisma.leaveRequest.count({
      where: {
        user: {
          managerId: session.user.id
        },
        status: 'PENDING',
        approvals: {
          some: {
            approverId: session.user.id,
            status: 'PENDING'
          }
        }
      }
    })

    // Transform data to match frontend format
    const formattedRequests = pendingRequests.map(request => ({
      id: request.id,
      employee: {
        name: `${request.user.firstName} ${request.user.lastName}`,
        avatar: request.user.image || '',
        department: request.user.department
      },
      type: request.leaveType.name,
      dates: `${new Date(request.startDate).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}`,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.totalDays,
      reason: request.reason,
      submittedDate: request.createdAt.toISOString(),
      substitute: request.substitute ? `${request.substitute.firstName} ${request.substitute.lastName}` : null,
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
    console.error("Error fetching pending approvals:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}