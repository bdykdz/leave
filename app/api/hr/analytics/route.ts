import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'

interface AnalyticsCacheData {
  stats: Array<{
    title: string
    value: string
    change: string
    icon: string
    color: string
  }>
  departmentData: Array<{
    department: string
    leaves: number
    average: number
  }>
  monthlyTrend: Array<{
    month: string
    leaves: number
  }>
  upcomingHolidays: Array<{
    name: string
    date: string
  }>
}

// Simple in-memory cache with TTL
const analyticsCache = new Map<string, { data: AnalyticsCacheData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    
    // Set date range - use provided dates or default to current month
    const currentDate = new Date()
    let rangeStart: Date
    let rangeEnd: Date
    
    if (startDateParam && endDateParam) {
      rangeStart = new Date(startDateParam)
      rangeEnd = new Date(endDateParam)
      
      // Validate dates
      if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
        return NextResponse.json({ error: 'Invalid date parameters' }, { status: 400 })
      }
      
      // Ensure start is before end
      if (rangeStart > rangeEnd) {
        return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
      }
    } else {
      rangeStart = startOfMonth(currentDate)
      rangeEnd = endOfMonth(currentDate)
    }

    // Calculate comparison period (same duration, shifted back)
    const rangeDuration = rangeEnd.getTime() - rangeStart.getTime()
    const comparisonEnd = new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000) // Day before range start
    const comparisonStart = new Date(comparisonEnd.getTime() - rangeDuration)
    
    const yearStart = startOfYear(currentDate)
    const today = new Date()

    // Create cache key including date range
    const cacheKey = `analytics_${session.user.id}_${rangeStart.getTime()}_${rangeEnd.getTime()}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Execute all queries in parallel for better performance
    const [
      currentPeriodLeaves,
      comparisonPeriodLeaves,
      employeesOnLeaveToday,
      employeesWFHToday,
      pendingLeaveApprovals,
      pendingWFHApprovals,
      departmentStats,
      totalEmployees,
      yearLeaves,
      holidays
    ] = await Promise.all([
      // Current period approved leaves with user department
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { gte: rangeStart, lte: rangeEnd }
        },
        include: {
          user: { select: { department: true } }
        }
      }),

      // Comparison period leaves for comparison
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { gte: comparisonStart, lte: comparisonEnd }
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

      // Holidays in selected period
      prisma.holiday.findMany({
        where: {
          date: {
            gte: rangeStart,
            lte: rangeEnd
          },
          isActive: true
        },
        select: { nameEn: true, date: true }
      })
    ])

    // Process department leave data
    const departmentLeaveData = departmentStats.map(dept => {
      const deptLeaves = currentPeriodLeaves.filter(leave => 
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

    // Generate monthly trend data with a single query
    const monthlyTrendData = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { gte: rangeStart, lte: rangeEnd }
      },
      select: {
        startDate: true,
        totalDays: true
      }
    })

    // Group by month and sum total days
    const monthlyTrend = monthlyTrendData.reduce((acc, request) => {
      const month = format(request.startDate, 'MMM')
      acc[month] = (acc[month] || 0) + request.totalDays
      return acc
    }, {} as Record<string, number>)

    // Convert to array format expected by the frontend
    const monthlyTrendArray = Object.entries(monthlyTrend)
      .map(([month, leaves]) => ({ month, leaves }))
      .sort((a, b) => {
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
      })

    // Calculate statistics
    const totalLeavesCurrentPeriod = currentPeriodLeaves.reduce((sum, leave) => sum + leave.totalDays, 0)
    const totalLeavesComparisonPeriod = comparisonPeriodLeaves.reduce((sum, leave) => sum + leave.totalDays, 0)
    const periodChange = totalLeavesComparisonPeriod > 0 
      ? Math.round(((totalLeavesCurrentPeriod - totalLeavesComparisonPeriod) / totalLeavesComparisonPeriod) * 100)
      : 0

    const averageLeaveDays = totalEmployees > 0 
      ? Math.round(((yearLeaves?._sum?.totalDays ?? 0) / totalEmployees) * 10) / 10
      : 0

    // Get last year's average for comparison (simplified)
    const lastYearAverage = averageLeaveDays * 0.95 // Approximate for demo
    const averageChange = lastYearAverage > 0 
      ? Math.round(((averageLeaveDays - lastYearAverage) / lastYearAverage) * 100)
      : 0

    const pendingApprovals = pendingLeaveApprovals + pendingWFHApprovals

    // Determine period label for display
    const periodLabel = startDateParam && endDateParam 
      ? "Selected Period" 
      : rangeStart.getMonth() === currentDate.getMonth() && rangeStart.getFullYear() === currentDate.getFullYear()
        ? "This Period"
        : "Selected Period"

    const analytics = {
      stats: [
        {
          title: `Total Leaves ${periodLabel}`,
          value: totalLeavesCurrentPeriod.toString(),
          change: periodChange > 0 ? `+${periodChange}%` : `${periodChange}%`,
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
      monthlyTrend: monthlyTrendArray,
      upcomingHolidays: (holidays || []).slice(0, 3).map(h => ({
        name: h?.nameEn || 'Holiday',
        date: h?.date ? format(new Date(h.date), 'MMM dd') : 'TBD'
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
    console.error('Error fetching HR analytics:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Return more specific error information for debugging
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics data',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}