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

    // Check if user is an executive
    if (!["EXECUTIVE", "HR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const currentYear = new Date().getFullYear()
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    // Get all approved leave requests for the current year
    const yearStart = new Date(currentYear, 0, 1)
    const yearEnd = new Date(currentYear, 11, 31)

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart }
      },
      include: {
        leaveType: true
      }
    })

    // Initialize monthly data
    const monthlyData = months.map((month, index) => ({
      month,
      totalDays: 0,
      vacationDays: 0,
      personalDays: 0,
      medicalDays: 0
    }))

    // Calculate leave days for each month
    approvedLeaves.forEach(leave => {
      const startDate = new Date(leave.startDate)
      const endDate = new Date(leave.endDate)
      
      // For each month, calculate how many days of this leave fall within it
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1)
        const monthEnd = new Date(currentYear, month + 1, 0)
        
        // Skip if leave doesn't overlap with this month
        if (endDate < monthStart || startDate > monthEnd) continue
        
        // Calculate overlap days
        const overlapStart = startDate > monthStart ? startDate : monthStart
        const overlapEnd = endDate < monthEnd ? endDate : monthEnd
        const daysInMonth = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        
        monthlyData[month].totalDays += daysInMonth
        
        // Categorize by leave type
        const leaveTypeName = leave.leaveType.name.toLowerCase()
        if (leaveTypeName.includes('vacation') || leaveTypeName.includes('annual')) {
          monthlyData[month].vacationDays += daysInMonth
        } else if (leaveTypeName.includes('personal') || leaveTypeName.includes('casual')) {
          monthlyData[month].personalDays += daysInMonth
        } else if (leaveTypeName.includes('medical') || leaveTypeName.includes('sick')) {
          monthlyData[month].medicalDays += daysInMonth
        } else {
          // Default to personal if can't categorize
          monthlyData[month].personalDays += daysInMonth
        }
      }
    })

    // Only return data up to current month for current year
    const currentMonth = new Date().getMonth()
    const dataToReturn = monthlyData.slice(0, currentMonth + 1)

    return NextResponse.json(dataToReturn)
  } catch (error) {
    console.error("Error fetching monthly patterns:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}