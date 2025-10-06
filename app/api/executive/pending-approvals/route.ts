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

    // Check if user is an executive or HR
    if (!["EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // For executives, get both level 2 leave approvals and pending WFH requests
    const requests: any[] = []
    
    // Get pending leave approvals that need executive approval (level 2)
    const pendingLeaveApprovals = await prisma.approval.findMany({
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
      }
    })

    // Get pending WFH requests (for HR visibility)
    let pendingWFHRequests: any[] = []
    if (session.user.role === "HR") {
      pendingWFHRequests = await prisma.workFromHomeRequest.findMany({
        where: {
          status: 'PENDING'
        },
        include: {
          user: {
            include: {
              manager: true
            }
          },
          approvals: {
            include: {
              approver: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
    }

    // Format leave requests
    const formattedLeaveRequests = pendingLeaveApprovals.map(approval => {
      const request = approval.leaveRequest
      const managerApproval = request.approvals.find(a => a.level === 1 && a.status === 'APPROVED')
      
      return {
        id: request.id,
        requestType: 'leave',
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
        days: request.totalDays,
        reason: request.reason,
        submittedDate: request.createdAt.toISOString(),
        substitute: request.substitute ? `${request.substitute.firstName} ${request.substitute.lastName}` : null,
        status: 'pending',
        managerApproved: !!managerApproval,
        managerApprovalDate: managerApproval?.approvedAt?.toISOString(),
        managerComments: managerApproval?.comments,
        requiresExecutiveApproval: true
      }
    })

    // Format WFH requests
    const formattedWFHRequests = pendingWFHRequests.map(request => {
      const managerApproval = request.approvals.find(a => a.status === 'PENDING')
      
      return {
        id: request.id,
        requestType: 'wfh',
        employee: {
          name: `${request.user.firstName} ${request.user.lastName}`,
          avatar: request.user.profileImage || '',
          department: request.user.department,
          position: request.user.position
        },
        type: 'Work From Home',
        dates: `${new Date(request.startDate).toLocaleDateString()} - ${new Date(request.endDate).toLocaleDateString()}`,
        startDate: request.startDate,
        endDate: request.endDate,
        days: request.totalDays,
        location: request.location,
        submittedDate: request.createdAt.toISOString(),
        status: 'pending',
        manager: request.user.manager ? `${request.user.manager.firstName} ${request.user.manager.lastName}` : null,
        requiresExecutiveApproval: false
      }
    })

    // Combine and sort all requests
    const allRequests = [...formattedLeaveRequests, ...formattedWFHRequests]
      .sort((a, b) => new Date(a.submittedDate).getTime() - new Date(b.submittedDate).getTime())

    // Apply pagination
    const paginatedRequests = allRequests.slice(skip, skip + limit)
    const totalCount = allRequests.length

    return NextResponse.json({
      requests: paginatedRequests,
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