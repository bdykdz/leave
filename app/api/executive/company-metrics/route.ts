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

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get total active employees
    const totalEmployees = await prisma.user.count({
      where: { isActive: true }
    })

    // Get employees on leave today
    const onLeaveToday = await prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today }
      }
    })

    // Get employees working remote today
    const workingRemoteToday = await prisma.workFromHomeRequest.count({
      where: {
        status: 'APPROVED',
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // Calculate in-office employees
    const inOfficeToday = totalEmployees - onLeaveToday - workingRemoteToday

    // Get pending executive approvals
    const pendingApprovals = await prisma.approval.count({
      where: {
        status: 'PENDING',
        level: 2 // Executive level approvals
      }
    })

    // Get current month stats
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    // Total leave days this month
    const approvedLeavesThisMonth = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: lastDayOfMonth },
        endDate: { gte: firstDayOfMonth }
      }
    })

    const totalLeaveDaysThisMonth = approvedLeavesThisMonth.reduce((total, leave) => {
      const start = leave.startDate > firstDayOfMonth ? leave.startDate : firstDayOfMonth
      const end = leave.endDate < lastDayOfMonth ? leave.endDate : lastDayOfMonth
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      return total + days
    }, 0)

    // Total remote days this month
    const totalRemoteDaysThisMonth = await prisma.workFromHomeRequest.count({
      where: {
        status: 'APPROVED',
        date: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth
        }
      }
    })

    // Calculate average leave days per employee (year to date)
    const yearStart = new Date(today.getFullYear(), 0, 1)
    const approvedLeavesYTD = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { gte: yearStart }
      }
    })

    const totalLeaveDaysYTD = approvedLeavesYTD.reduce((total, leave) => total + leave.days, 0)
    const averageLeaveDaysPerEmployee = totalEmployees > 0 ? (totalLeaveDaysYTD / totalEmployees).toFixed(1) : 0

    // Calculate leave utilization rate
    // Assuming each employee gets 21 days of leave per year
    const expectedLeavePerEmployee = 21
    const expectedTotalLeave = totalEmployees * expectedLeavePerEmployee
    const monthsElapsed = today.getMonth() + 1
    const expectedLeaveYTD = (expectedTotalLeave * monthsElapsed) / 12
    const leaveUtilizationRate = expectedLeaveYTD > 0 ? Math.round((totalLeaveDaysYTD / expectedLeaveYTD) * 100) : 0

    return NextResponse.json({
      totalEmployees,
      onLeaveToday,
      workingRemoteToday,
      inOfficeToday,
      pendingApprovals,
      totalLeaveDaysThisMonth,
      totalRemoteDaysThisMonth,
      averageLeaveDaysPerEmployee: Number(averageLeaveDaysPerEmployee),
      leaveUtilizationRate
    })
  } catch (error) {
    console.error("Error fetching company metrics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}