import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay } from "date-fns"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const today = new Date()
    const startOfToday = startOfDay(today)
    const endOfToday = endOfDay(today)

    // Get people on leave today
    const onLeaveToday = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfToday },
        endDate: { gte: startOfToday }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            profileImage: true
          }
        },
        leaveType: {
          select: {
            name: true
          }
        }
      }
    })

    // Get people working from home today
    const workingFromHomeToday = await prisma.workFromHomeRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfToday },
        endDate: { gte: startOfToday }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            profileImage: true
          }
        }
      }
    })

    // Get people the current user is substituting for (active leave requests where user is substitute)
    const substitutingFor = await prisma.leaveRequestSubstitute.findMany({
      where: {
        userId: session.user.id,
        leaveRequest: {
          status: 'APPROVED',
          startDate: { lte: endOfToday },
          endDate: { gte: startOfToday }
        }
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                profileImage: true
              }
            },
            leaveType: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    // Get pending substitute requests where the current user is requested as substitute
    const pendingSubstituteRequests = await prisma.leaveRequestSubstitute.findMany({
      where: {
        userId: session.user.id,
        leaveRequest: {
          status: 'PENDING' // Only pending requests need action
        }
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                profileImage: true
              }
            },
            leaveType: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    // Format the data for the frontend
    const summaryData = {
      onLeaveToday: onLeaveToday.map(request => ({
        id: request.user.id,
        name: `${request.user.firstName} ${request.user.lastName}`,
        leaveType: request.leaveType.name,
        avatar: request.user.profileImage,
        department: request.user.department
      })),
      
      workingFromHomeToday: workingFromHomeToday.map(request => ({
        id: request.user.id,
        name: `${request.user.firstName} ${request.user.lastName}`,
        location: request.location,
        avatar: request.user.profileImage,
        department: request.user.department
      })),
      
      substitutingFor: substitutingFor.map(substitute => ({
        id: substitute.leaveRequest.user.id,
        requestId: substitute.leaveRequest.id,
        name: `${substitute.leaveRequest.user.firstName} ${substitute.leaveRequest.user.lastName}`,
        leaveType: substitute.leaveRequest.leaveType.name,
        startDate: substitute.leaveRequest.startDate.toISOString(),
        endDate: substitute.leaveRequest.endDate.toISOString(),
        avatar: substitute.leaveRequest.user.profileImage,
        department: substitute.leaveRequest.user.department
      })),
      
      pendingSubstituteRequests: pendingSubstituteRequests.map(substitute => ({
        id: substitute.leaveRequest.user.id,
        requestId: substitute.leaveRequest.id,
        requesterName: `${substitute.leaveRequest.user.firstName} ${substitute.leaveRequest.user.lastName}`,
        leaveType: substitute.leaveRequest.leaveType.name,
        startDate: substitute.leaveRequest.startDate.toISOString(),
        endDate: substitute.leaveRequest.endDate.toISOString(),
        status: substitute.leaveRequest.status,
        avatar: substitute.leaveRequest.user.profileImage,
        department: substitute.leaveRequest.user.department
      }))
    }

    return NextResponse.json(summaryData)
  } catch (error) {
    console.error("Error fetching dashboard summary:", error)
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}