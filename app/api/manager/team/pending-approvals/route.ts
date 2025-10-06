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

    // Get pending leave requests from team members
    const pendingLeaveRequests = await prisma.leaveRequest.findMany({
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
      take: Math.ceil(limit / 2) // Split limit between leave and WFH
    })

    // Get pending WFH requests from team members (excluding manager's own requests)
    const pendingWFHRequests = await prisma.workFromHomeRequest.findMany({
      where: {
        user: {
          managerId: session.user.id
        },
        userId: {
          not: session.user.id // Exclude manager's own WFH requests
        },
        status: 'PENDING'
      },
      include: {
        user: true,
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
      take: Math.ceil(limit / 2) // Split limit between leave and WFH
    })

    // Get total counts for pagination
    const totalLeaveCount = await prisma.leaveRequest.count({
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

    const totalWFHCount = await prisma.workFromHomeRequest.count({
      where: {
        user: {
          managerId: session.user.id
        },
        userId: {
          not: session.user.id // Exclude manager's own WFH requests
        },
        status: 'PENDING'
      }
    })

    const totalCount = totalLeaveCount + totalWFHCount

    // Transform leave requests data
    const formattedLeaveRequests = pendingLeaveRequests.map(request => ({
      id: request.id,
      requestType: 'leave',
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

    // Transform WFH requests data
    const formattedWFHRequests = pendingWFHRequests.map(request => ({
      id: request.id,
      requestType: 'wfh',
      employee: {
        name: `${request.user.firstName} ${request.user.lastName}`,
        avatar: request.user.image || '',
        department: request.user.department
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

    // Combine and sort all requests by submission date
    const formattedRequests = [...formattedLeaveRequests, ...formattedWFHRequests]
      .sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime())
      .slice(0, limit)

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