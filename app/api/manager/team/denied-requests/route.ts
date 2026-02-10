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

    // Get requests that this manager has denied (regardless of overall status)
    const deniedRequests = await prisma.leaveRequest.findMany({
      where: {
        approvals: {
          some: {
            approverId: session.user.id,
            status: 'REJECTED'
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
        updatedAt: 'desc'
      },
      skip,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.leaveRequest.count({
      where: {
        approvals: {
          some: {
            approverId: session.user.id,
            status: 'REJECTED'
          }
        }
      }
    })

    // Transform data to match frontend format
    const formattedRequests = deniedRequests.map(request => {
      const approval = request.approvals[0]
      return {
        id: request.id,
        employee: {
          name: `${request.user?.firstName || ''} ${request.user?.lastName || ''}`.trim() || 'Unknown',
          avatar: request.user?.image || '',
          department: request.user?.department || ''
        },
        type: request.leaveType?.name || 'Unknown',
        dates: `${new Date(request.startDate).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}`,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.totalDays,
        reason: request.reason,
        submittedDate: request.createdAt.toISOString(),
        deniedDate: approval?.approvedAt?.toISOString() || request.updatedAt.toISOString(),
        denialReason: approval?.comments || '',
        substitute: request.substitute ? `${request.substitute?.firstName || ''} ${request.substitute?.lastName || ''}` : null,
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
    console.error("Error fetching denied requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}