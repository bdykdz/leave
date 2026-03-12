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
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10') || 10, 1), 100)
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1)
    const type = searchParams.get('type') // 'leave' to filter leave-only
    const skip = (page - 1) * limit

    // Get pending leave requests where this user is an approver OR from direct reports
    const pendingLeaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [
          {
            // Has pending approval for this user
            approvals: {
              some: {
                approverId: session.user.id,
                status: 'PENDING'
              }
            }
          },
          {
            // Direct report request that might not have approval record yet
            // Exclude if the manager has already approved/rejected their approval
            user: {
              managerId: session.user.id
            },
            approvals: {
              none: {
                approverId: session.user.id,
                status: { in: ['APPROVED', 'REJECTED'] }
              }
            }
          }
        ]
      },
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
      take: type === 'leave' ? limit : Math.ceil(limit / 2) // Full limit when leave-only, split when combined
    })

    // When type=leave, skip WFH and work trip queries entirely
    let pendingWFHRequests: any[] = []
    let totalWFHCount = 0
    let pendingWorkTripRequests: any[] = []
    let totalWorkTripCount = 0

    if (type !== 'leave') {
      // Get pending WFH requests where this user needs to approve OR from direct reports
      pendingWFHRequests = await prisma.workFromHomeRequest.findMany({
        where: {
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
              },
              approvals: {
                none: {
                  approverId: session.user.id,
                  status: { in: ['APPROVED', 'REJECTED'] }
                }
              }
            }
          ]
        },
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
        take: Math.ceil(limit / 2)
      })

      totalWFHCount = await prisma.workFromHomeRequest.count({
        where: {
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
              },
              approvals: {
                none: {
                  approverId: session.user.id,
                  status: { in: ['APPROVED', 'REJECTED'] }
                }
              }
            }
          ]
        }
      })

      // Get pending work trip requests
      pendingWorkTripRequests = await prisma.workTripRequest.findMany({
        where: {
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
              },
              approvals: {
                none: {
                  approverId: session.user.id,
                  status: { in: ['APPROVED', 'REJECTED'] }
                }
              }
            }
          ]
        },
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
        take: Math.ceil(limit / 3)
      })

      totalWorkTripCount = await prisma.workTripRequest.count({
        where: {
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
              },
              approvals: {
                none: {
                  approverId: session.user.id,
                  status: { in: ['APPROVED', 'REJECTED'] }
                }
              }
            }
          ]
        }
      })
    }

    // Get total counts for pagination
    const totalLeaveCount = await prisma.leaveRequest.count({
      where: {
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
            },
            approvals: {
              none: {
                approverId: session.user.id,
                status: { in: ['APPROVED', 'REJECTED'] }
              }
            }
          }
        ]
      }
    })

    const totalCount = totalLeaveCount + totalWFHCount + totalWorkTripCount

    // Transform leave requests data
    const formattedLeaveRequests = pendingLeaveRequests.map(request => ({
      id: request.id,
      requestType: 'leave',
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
      substitute: request.substitute ? `${request.substitute?.firstName || ''} ${request.substitute?.lastName || ''}` : null,
      status: 'pending'
    }))

    // Transform WFH requests data
    const formattedWFHRequests = pendingWFHRequests.map(request => ({
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

    // Transform work trip requests data
    const formattedWorkTripRequests = pendingWorkTripRequests.map((request: any) => ({
      id: request.id,
      requestType: 'workTrip',
      employee: {
        name: `${request.user?.firstName || ''} ${request.user?.lastName || ''}`.trim() || 'Unknown',
        avatar: request.user?.image || '',
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
      substitute: null,
      status: 'pending'
    }))

    // Combine and sort all requests by submission date
    const formattedRequests = [...formattedLeaveRequests, ...formattedWFHRequests, ...formattedWorkTripRequests]
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