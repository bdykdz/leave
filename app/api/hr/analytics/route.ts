import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr')
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const currentDate = new Date()
    const currentMonthStart = startOfMonth(currentDate)
    const currentMonthEnd = endOfMonth(currentDate)
    const lastMonthStart = startOfMonth(subMonths(currentDate, 1))
    const lastMonthEnd = endOfMonth(subMonths(currentDate, 1))
    const yearStart = startOfYear(currentDate)

    // Get current month leave statistics
    const currentMonthLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: {
          gte: currentMonthStart,
          lte: currentMonthEnd
        }
      },
      include: {
        user: {
          select: {
            department: true
          }
        }
      }
    })

    // Get last month leave statistics for comparison
    const lastMonthLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: {
          gte: lastMonthStart,
          lte: lastMonthEnd
        }
      }
    })

    // Get employees currently on leave (today)
    const today = new Date()
    const employeesOnLeaveToday = await prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today }
      }
    })

    // Get pending approvals
    const pendingApprovals = await prisma.leaveRequest.count({
      where: {
        status: 'PENDING_APPROVAL'
      }
    })

    // Calculate department statistics
    const departmentStats = await prisma.user.groupBy({
      by: ['department'],
      _count: {
        id: true
      },
      where: {
        isActive: true,
        department: {
          not: null
        }
      }
    })

    // Get department leave data for current month
    const departmentLeaveData = []
    for (const dept of departmentStats) {
      const deptLeaves = currentMonthLeaves.filter(leave => 
        leave.user.department === dept.department
      )
      const totalDays = deptLeaves.reduce((sum, leave) => sum + leave.totalDays, 0)
      const averageDays = dept._count.id > 0 ? totalDays / dept._count.id : 0

      departmentLeaveData.push({
        department: dept.department || 'Unknown',
        leaves: totalDays,
        average: Math.round(averageDays * 10) / 10 // Round to 1 decimal
      })
    }

    // Get monthly trend data for the past 6 months
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(currentDate, i)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)

      const monthLeaves = await prisma.leaveRequest.aggregate({
        where: {
          status: 'APPROVED',
          startDate: {
            gte: monthStart,
            lte: monthEnd
          }
        },
        _sum: {
          totalDays: true
        }
      })

      monthlyTrend.push({
        month: format(monthDate, 'MMM'),
        leaves: monthLeaves._sum.totalDays || 0
      })
    }

    // Calculate statistics
    const totalLeavesThisMonth = currentMonthLeaves.reduce((sum, leave) => sum + leave.totalDays, 0)
    const totalLeavesLastMonth = lastMonthLeaves.reduce((sum, leave) => sum + leave.totalDays, 0)
    const monthlyChange = totalLeavesLastMonth > 0 
      ? Math.round(((totalLeavesThisMonth - totalLeavesLastMonth) / totalLeavesLastMonth) * 100)
      : 0

    // Calculate average leave days per employee this year
    const totalEmployees = await prisma.user.count({
      where: { isActive: true }
    })

    const yearLeaves = await prisma.leaveRequest.aggregate({
      where: {
        status: 'APPROVED',
        startDate: {
          gte: yearStart
        }
      },
      _sum: {
        totalDays: true
      }
    })

    const averageLeaveDays = totalEmployees > 0 
      ? Math.round((yearLeaves._sum.totalDays || 0) / totalEmployees * 10) / 10
      : 0

    // Get last year's average for comparison
    const lastYearStart = startOfYear(subMonths(currentDate, 12))
    const lastYearEnd = endOfMonth(subMonths(currentDate, 12))
    
    const lastYearLeaves = await prisma.leaveRequest.aggregate({
      where: {
        status: 'APPROVED',
        startDate: {
          gte: lastYearStart,
          lte: lastYearEnd
        }
      },
      _sum: {
        totalDays: true
      }
    })

    const lastYearAverage = totalEmployees > 0 
      ? (lastYearLeaves._sum.totalDays || 0) / totalEmployees
      : 0

    const averageChange = lastYearAverage > 0 
      ? Math.round(((averageLeaveDays - lastYearAverage) / lastYearAverage) * 100)
      : 0

    const analytics = {
      stats: [
        {
          title: "Total Leaves This Month",
          value: totalLeavesThisMonth.toString(),
          change: monthlyChange > 0 ? `+${monthlyChange}%` : `${monthlyChange}%`,
          icon: "Calendar",
          color: "text-blue-600"
        },
        {
          title: "Average Leave Days",
          value: averageLeaveDays.toString(),
          change: averageChange > 0 ? `+${averageChange}%` : `${averageChange}%`,
          icon: "TrendingUp",
          color: averageChange < 0 ? "text-green-600" : "text-red-600"
        },
        {
          title: "Employees on Leave Today",
          value: employeesOnLeaveToday.toString(),
          change: "real-time",
          icon: "Users",
          color: "text-purple-600"
        },
        {
          title: "Pending Approvals",
          value: pendingApprovals.toString(),
          change: "requires action",
          icon: "AlertCircle",
          color: "text-orange-600"
        }
      ],
      departmentData: departmentLeaveData.sort((a, b) => b.leaves - a.leaves),
      monthlyTrend: monthlyTrend
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error fetching HR analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}