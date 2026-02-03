import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { startOfYear, endOfYear, addYears, format } from 'date-fns'

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

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const includeAnalytics = searchParams.get('analytics') === 'true'
    
    const startDate = startOfYear(new Date(parseInt(year), 0, 1))
    const endDate = endOfYear(new Date(parseInt(year), 0, 1))
    
    // Get holidays for the specified year
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      orderBy: { date: 'asc' }
    })

    let analytics = null
    
    if (includeAnalytics) {
      // Get analytics for holiday impact on leave planning
      const [
        totalLeaveRequests,
        leaveRequestsAroundHolidays,
        blockedHolidays,
        departmentStats
      ] = await Promise.all([
        // Total leave requests in the year
        prisma.leaveRequest.count({
          where: {
            startDate: { gte: startDate, lte: endDate },
            status: { in: ['APPROVED', 'PENDING'] }
          }
        }),

        // Leave requests that extend holiday weekends (within 3 days of holidays)
        prisma.leaveRequest.findMany({
          where: {
            startDate: { gte: startDate, lte: endDate },
            status: { in: ['APPROVED', 'PENDING'] },
            OR: holidays.flatMap(holiday => [
              {
                startDate: {
                  gte: new Date(new Date(holiday.date).getTime() - 3 * 24 * 60 * 60 * 1000),
                  lte: new Date(new Date(holiday.date).getTime() + 3 * 24 * 60 * 60 * 1000)
                }
              },
              {
                endDate: {
                  gte: new Date(new Date(holiday.date).getTime() - 3 * 24 * 60 * 60 * 1000),
                  lte: new Date(new Date(holiday.date).getTime() + 3 * 24 * 60 * 60 * 1000)
                }
              }
            ])
          },
          include: {
            user: {
              select: {
                department: true
              }
            }
          }
        }),

        // Blocked holidays (where leave requests are not allowed)
        prisma.holiday.findMany({
          where: {
            date: { gte: startDate, lte: endDate },
            isActive: true,
            isBlocked: true
          }
        }),

        // Department usage patterns around holidays
        prisma.leaveRequest.groupBy({
          by: ['userId'],
          where: {
            startDate: { gte: startDate, lte: endDate },
            status: { in: ['APPROVED', 'PENDING'] },
            OR: holidays.flatMap(holiday => [
              {
                startDate: {
                  gte: new Date(new Date(holiday.date).getTime() - 7 * 24 * 60 * 60 * 1000),
                  lte: new Date(new Date(holiday.date).getTime() + 7 * 24 * 60 * 60 * 1000)
                }
              }
            ])
          },
          _count: {
            id: true
          }
        })
      ])

      // Calculate holiday impact metrics
      const holidayExtensions = leaveRequestsAroundHolidays.length
      const totalHolidays = holidays.length
      const mandatoryWorkDays = blockedHolidays.length
      
      // Group by month for trending
      const monthlyBreakdown = holidays.reduce((acc, holiday) => {
        const month = format(holiday.date, 'MMM')
        acc[month] = (acc[month] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      analytics = {
        totalHolidays,
        mandatoryWorkDays,
        holidayExtensions,
        utilizationRate: totalLeaveRequests > 0 ? Math.round((holidayExtensions / totalLeaveRequests) * 100) : 0,
        monthlyBreakdown,
        departmentImpact: departmentStats.length,
        upcomingHolidays: holidays.filter(h => h.date > new Date()).slice(0, 5)
      }
    }

    // Get years with holidays for year selector
    const availableYears = await prisma.holiday.findMany({
      select: { date: true },
      where: { isActive: true },
      orderBy: { date: 'asc' }
    })

    const years = [...new Set(availableYears.map(h => new Date(h.date).getFullYear()))]
      .sort((a, b) => b - a) // Most recent first

    return NextResponse.json({
      holidays: holidays.map(holiday => ({
        id: holiday.id,
        nameEn: holiday.nameEn,
        nameRo: holiday.nameRo,
        date: holiday.date,
        description: holiday.description,
        isRecurring: holiday.isRecurring,
        isBlocked: holiday.isBlocked,
        country: holiday.country,
        isActive: holiday.isActive
      })),
      analytics,
      availableYears: years,
      currentYear: parseInt(year)
    })

  } catch (error) {
    console.error('Error fetching HR holidays:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holidays' },
      { status: 500 }
    )
  }
}

// PATCH: Update holiday blocking status (HR can toggle whether holidays block leave requests)
export async function PATCH(request: NextRequest) {
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

    const { holidayId, isBlocked } = await request.json()

    if (!holidayId || typeof isBlocked !== 'boolean') {
      return NextResponse.json({ 
        error: 'Holiday ID and blocking status are required' 
      }, { status: 400 })
    }

    const holiday = await prisma.holiday.update({
      where: { id: holidayId },
      data: { isBlocked }
    })

    return NextResponse.json({
      success: true,
      message: `Holiday ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      holiday: {
        id: holiday.id,
        nameEn: holiday.nameEn,
        isBlocked: holiday.isBlocked
      }
    })

  } catch (error) {
    console.error('Error updating holiday:', error)
    return NextResponse.json(
      { error: 'Failed to update holiday' },
      { status: 500 }
    )
  }
}