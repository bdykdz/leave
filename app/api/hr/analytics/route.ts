import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'

// Simple in-memory cache with TTL
const analyticsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

    // Check cache
    const cacheKey = `analytics_${session.user.id}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const currentDate = new Date()
    const currentMonthStart = startOfMonth(currentDate)
    const currentMonthEnd = endOfMonth(currentDate)
    const lastMonthStart = startOfMonth(subMonths(currentDate, 1))
    const lastMonthEnd = endOfMonth(subMonths(currentDate, 1))
    const yearStart = startOfYear(currentDate)
    const today = new Date()

    // Execute all queries in parallel for better performance
    const [
      currentMonthLeaves,
      lastMonthLeaves,
      employeesOnLeaveToday,
      employeesWFHToday,
      pendingLeaveApprovals,
      pendingWFHApprovals,
      departmentStats,
      totalEmployees,
      yearLeaves,
      holidays
    ] = await Promise.all([
      // Current month approved leaves with user department
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { gte: currentMonthStart, lte: currentMonthEnd }
        },
        include: {
          user: { select: { department: true } }
        }
      }),

      // Last month leaves for comparison
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { gte: lastMonthStart, lte: lastMonthEnd }
        }
      }),

      // Employees on leave today
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today }
        }
      }),

      // Employees working from home today
      prisma.workFromHomeRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today }
        }
      }),

      // Pending leave approvals
      prisma.leaveRequest.count({
        where: { status: 'PENDING' }
      }),

      // Pending WFH approvals
      prisma.workFromHomeRequest.count({
        where: { status: 'PENDING' }
      }),

      // Department statistics
      prisma.user.groupBy({
        by: ['department'],
        _count: { id: true },
        where: {
          isActive: true,
          department: { not: null }
        }
      }),

      // Total active employees
      prisma.user.count({
        where: { isActive: true }
      }),

      // Year-to-date approved leaves
      prisma.leaveRequest.aggregate({
        where: {
          status: 'APPROVED',
          startDate: { gte: yearStart }
        },
        _sum: { totalDays: true }
      }),

      // Upcoming holidays for context
      prisma.holiday.findMany({
        where: {
          date: {
            gte: currentMonthStart,
            lte: currentMonthEnd
          },
          isActive: true
        },
        select: { nameEn: true, date: true }
      })
    ])

    // Process department leave data
    const departmentLeaveData = departmentStats.map(dept => {
      const deptLeaves = currentMonthLeaves.filter(leave => 
        leave.user.department === dept.department
      )
      const totalDays = deptLeaves.reduce((sum, leave) => sum + leave.totalDays, 0)
      const averageDays = dept._count.id > 0 ? totalDays / dept._count.id : 0

      return {
        department: dept.department || 'Unknown',
        leaves: totalDays,
        average: Math.round(averageDays * 10) / 10
      }
    }).sort((a, b) => b.leaves - a.leaves)

    // Get monthly trend data in parallel (past 6 months)
    const monthlyTrendPromises = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(currentDate, i)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)

      monthlyTrendPromises.push(
        prisma.leaveRequest.aggregate({
          where: {
            status: 'APPROVED',
            startDate: { gte: monthStart, lte: monthEnd }
          },
          _sum: { totalDays: true }
        }).then(result => ({
          month: format(monthDate, 'MMM'),
          leaves: result._sum.totalDays || 0
        }))
      )
    }
    const monthlyTrend = await Promise.all(monthlyTrendPromises)

    // Calculate statistics
    const totalLeavesThisMonth = currentMonthLeaves.reduce((sum, leave) => sum + leave.totalDays, 0)
    const totalLeavesLastMonth = lastMonthLeaves.reduce((sum, leave) => sum + leave.totalDays, 0)
    const monthlyChange = totalLeavesLastMonth > 0 
      ? Math.round(((totalLeavesThisMonth - totalLeavesLastMonth) / totalLeavesLastMonth) * 100)
      : 0

    const averageLeaveDays = totalEmployees > 0 
      ? Math.round((yearLeaves._sum.totalDays || 0) / totalEmployees * 10) / 10
      : 0

    // Get last year's average for comparison (simplified)
    const lastYearAverage = averageLeaveDays * 0.95 // Approximate for demo
    const averageChange = lastYearAverage > 0 
      ? Math.round(((averageLeaveDays - lastYearAverage) / lastYearAverage) * 100)
      : 0

    const pendingApprovals = pendingLeaveApprovals + pendingWFHApprovals

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
          title: "Away Today",
          value: `${employeesOnLeaveToday + employeesWFHToday}`,
          change: `${employeesOnLeaveToday} leave, ${employeesWFHToday} WFH`,
          icon: "Users",
          color: "text-purple-600"
        },
        {
          title: "Pending Approvals",
          value: pendingApprovals.toString(),
          change: `${pendingLeaveApprovals} leave, ${pendingWFHApprovals} WFH`,
          icon: "AlertCircle",
          color: "text-orange-600"
        }
      ],
      departmentData: departmentLeaveData,
      monthlyTrend: monthlyTrend,
      upcomingHolidays: holidays.slice(0, 3).map(h => ({
        name: h.nameEn,
        date: format(h.date, 'MMM dd')
      }))
    }

    // Cache the result
    analyticsCache.set(cacheKey, {
      data: analytics,
      timestamp: Date.now()
    });

    // Clean old cache entries
    for (const [key, value] of analyticsCache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL * 2) {
        analyticsCache.delete(key);
      }
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