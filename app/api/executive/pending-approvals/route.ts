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

    // Check if user is an executive
    if (!["EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Get pending approvals that need executive approval (level 2)
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        level: 2,
        status: 'PENDING'
      },
      include: {
        leaveRequest: {
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
              orderBy: {
                level: 'asc'
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      skip,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.approval.count({
      where: {
        level: 2,
        status: 'PENDING'
      }
    })

    // Transform data to match frontend format
    const formattedRequests = pendingApprovals.map(approval => {
      const request = approval.leaveRequest
      const managerApproval = request.approvals.find(a => a.level === 1 && a.status === 'APPROVED')
      
      return {
        id: request.id,
        employee: {
          name: `${request.user.firstName} ${request.user.lastName}`,
          avatar: request.user.profileImage || '',
          department: request.user.department,
          position: request.user.position
        },
        type: request.leaveType.name,
        dates: `${new Date(request.startDate).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}`,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.days,
        reason: request.reason,
        submittedDate: request.createdAt.toISOString(),
        substitute: request.substitute ? `${request.substitute.firstName} ${request.substitute.lastName}` : null,
        status: 'pending',
        managerApproved: !!managerApproval,
        managerApprovalDate: managerApproval?.approvedAt?.toISOString(),
        managerComments: managerApproval?.comments
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
    console.error("Error fetching executive pending approvals:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}