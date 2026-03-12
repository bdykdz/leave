import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { CacheService } from "@/lib/services/cache-service"
import { isSameDay } from "date-fns"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a manager
    if (!["MANAGER", "DEPARTMENT_DIRECTOR", "EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Try to get from cache first
    const cachedData = await CacheService.getTeamStats(session.user.id)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get all team members reporting to this manager
    const teamMembers = await prisma.user.findMany({
      where: {
        managerId: session.user.id,
        isActive: true
      },
      include: {
        leaveRequests: {
          where: {
            status: 'APPROVED',
            startDate: { lte: today },
            endDate: { gte: today }
          },
          include: {
            leaveType: true
          }
        }
      }
    })

    // Get approved WFH requests that cover today for team members
    const teamMemberIds = teamMembers.map(m => m.id)
    const wfhRequestsToday = await prisma.workFromHomeRequest.findMany({
      where: {
        userId: { in: teamMemberIds },
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today }
      },
      select: {
        userId: true,
        selectedDates: true,
        startDate: true,
        endDate: true
      }
    })

    // Build a set of user IDs who are actually WFH today (checking selectedDates)
    const wfhTodayUserIds = new Set<string>()
    for (const req of wfhRequestsToday) {
      const selectedDates = req.selectedDates as string[] | null
      if (selectedDates && selectedDates.length > 0) {
        if (selectedDates.some(d => isSameDay(new Date(d), today))) {
          wfhTodayUserIds.add(req.userId)
        }
      } else {
        // No selectedDates — date range already covers today
        wfhTodayUserIds.add(req.userId)
      }
    }

    // Get approved work trip requests that cover today for team members
    const workTripRequestsToday = await prisma.workTripRequest.findMany({
      where: {
        userId: { in: teamMemberIds },
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today }
      },
      select: {
        userId: true,
        selectedDates: true,
        startDate: true,
        endDate: true
      }
    })

    const workTripTodayUserIds = new Set<string>()
    for (const req of workTripRequestsToday) {
      const selectedDates = req.selectedDates as string[] | null
      if (selectedDates && selectedDates.length > 0) {
        if (selectedDates.some(d => isSameDay(new Date(d), today))) {
          workTripTodayUserIds.add(req.userId)
        }
      } else {
        workTripTodayUserIds.add(req.userId)
      }
    }

    // Get pending approval requests (leave, WFH, and work trips)
    const [pendingLeaveCount, pendingWfhCount, pendingWorkTripCount] = await Promise.all([
      prisma.leaveRequest.count({
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
      }),
      prisma.workFromHomeRequest.count({
        where: {
          status: 'PENDING',
          user: {
            managerId: session.user.id
          },
          approvals: {
            some: {
              approverId: session.user.id,
              status: 'PENDING'
            }
          }
        }
      }),
      prisma.workTripRequest.count({
        where: {
          status: 'PENDING',
          user: {
            managerId: session.user.id
          },
          approvals: {
            some: {
              approverId: session.user.id,
              status: 'PENDING'
            }
          }
        }
      })
    ])
    const pendingRequests = pendingLeaveCount + pendingWfhCount + pendingWorkTripCount

    // Calculate team stats and collect member names by status
    let onLeaveToday = 0
    let workingFromHome = 0
    let onWorkTrip = 0
    let inOffice = 0
    const inOfficeMembers: string[] = []
    const onLeaveMembers: string[] = []
    const wfhMembers: string[] = []
    const workTripMembers: string[] = []

    teamMembers.forEach(member => {
      const name = `${member.firstName} ${member.lastName}`
      if (workTripTodayUserIds.has(member.id)) {
        onWorkTrip++
        workTripMembers.push(name)
      } else if (wfhTodayUserIds.has(member.id)) {
        workingFromHome++
        wfhMembers.push(name)
      } else if (member.leaveRequests.length > 0) {
        onLeaveToday++
        onLeaveMembers.push(name)
      } else {
        inOffice++
        inOfficeMembers.push(name)
      }
    })

    const teamStatsData = {
      totalMembers: teamMembers.length,
      onLeaveToday,
      workingFromHome,
      onWorkTrip,
      inOffice,
      pendingRequests,
      inOfficeMembers,
      onLeaveMembers,
      wfhMembers,
      workTripMembers
    }

    // Cache the result
    await CacheService.setTeamStats(session.user.id, teamStatsData)

    return NextResponse.json(teamStatsData)
  } catch (error) {
    console.error("Error fetching team overview:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}