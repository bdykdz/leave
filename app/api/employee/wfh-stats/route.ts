import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, format, getDay, eachDayOfInterval } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month') // Expected format: YYYY-MM

    if (!monthParam) {
      return NextResponse.json({ error: 'Month parameter is required' }, { status: 400 })
    }

    // Validate month parameter format
    const monthRegex = /^\d{4}-\d{2}$/
    if (!monthRegex.test(monthParam)) {
      return NextResponse.json({ error: 'Invalid month format. Expected YYYY-MM' }, { status: 400 })
    }

    // Parse the month parameter
    const [year, month] = monthParam.split('-').map(Number)
    
    // Validate year and month ranges
    if (year < 2020 || year > 2030 || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month value' }, { status: 400 })
    }
    
    const targetDate = new Date(year, month - 1, 1) // month is 0-indexed in Date constructor
    
    // Additional validation - ensure date was created correctly
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const monthStart = startOfMonth(targetDate)
    const monthEnd = endOfMonth(targetDate)

    // Get all approved WFH requests for the user in this month
    const wfhRequests = await prisma.workFromHomeRequest.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        OR: [
          {
            startDate: {
              gte: monthStart,
              lte: monthEnd
            }
          },
          {
            endDate: {
              gte: monthStart,
              lte: monthEnd
            }
          },
          {
            AND: [
              { startDate: { lte: monthStart } },
              { endDate: { gte: monthEnd } }
            ]
          }
        ]
      },
      select: {
        startDate: true,
        endDate: true,
        totalDays: true,
        selectedDates: true
      }
    })

    // Collect the actual WFH dates used in this month
    const wfhDates = new Set<string>()

    for (const request of wfhRequests) {
      const selectedDates = request.selectedDates as string[] | null

      if (selectedDates && selectedDates.length > 0) {
        // Use selectedDates: count only the specific dates that fall within the target month
        for (const dateStr of selectedDates) {
          const date = new Date(dateStr)
          const dayOfWeek = getDay(date)
          if (date >= monthStart && date <= monthEnd && dayOfWeek !== 0 && dayOfWeek !== 6) {
            wfhDates.add(format(date, 'yyyy-MM-dd'))
          }
        }
      } else {
        // Fallback: count all business days in the startDate-endDate range
        const requestStart = request.startDate > monthStart ? request.startDate : monthStart
        const requestEnd = request.endDate < monthEnd ? request.endDate : monthEnd

        if (requestStart <= requestEnd) {
          const days = eachDayOfInterval({ start: requestStart, end: requestEnd })
          for (const day of days) {
            const dayOfWeek = getDay(day)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              wfhDates.add(format(day, 'yyyy-MM-dd'))
            }
          }
        }
      }
    }

    const totalWfhDays = wfhDates.size

    // Calculate total working days in the month (excluding weekends)
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const workingDaysInMonth = allDaysInMonth.filter(day => {
      const dayOfWeek = getDay(day)
      return dayOfWeek !== 0 && dayOfWeek !== 6 // Exclude Sunday (0) and Saturday (6)
    }).length

    // Calculate percentage
    const percentage = workingDaysInMonth > 0 ? Math.round((totalWfhDays / workingDaysInMonth) * 100) : 0

    const wfhStats = {
      monthKey: monthParam,
      daysUsed: totalWfhDays,
      workingDaysInMonth,
      percentage,
      monthName: format(targetDate, 'MMMM yyyy'),
      dates: Array.from(wfhDates).sort()
    }

    return NextResponse.json(wfhStats)
  } catch (error) {
    console.error('Error fetching WFH stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch WFH statistics' },
      { status: 500 }
    )
  }
}