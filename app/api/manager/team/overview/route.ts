import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

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

    // Get pending approval requests
    const pendingRequests = await prisma.leaveRequest.count({
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

    // Calculate team stats
    let onLeaveToday = 0
    let workingFromHome = 0
    let inOffice = 0

    teamMembers.forEach(member => {
      if (member.leaveRequests.length > 0) {
        const activeRequest = member.leaveRequests[0]
        if (activeRequest.leaveType.name.toLowerCase().includes('work from home') || 
            activeRequest.leaveType.name.toLowerCase() === 'wfh') {
          workingFromHome++
        } else {
          onLeaveToday++
        }
      } else {
        inOffice++
      }
    })

    return NextResponse.json({
      totalMembers: teamMembers.length,
      onLeaveToday,
      workingFromHome,
      inOffice,
      pendingRequests
    })
  } catch (error) {
    console.error("Error fetching team overview:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}