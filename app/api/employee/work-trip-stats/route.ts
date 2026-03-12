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
    const monthParam = searchParams.get('month')

    if (!monthParam) {
      return NextResponse.json({ error: 'Month parameter is required' }, { status: 400 })
    }

    const monthRegex = /^\d{4}-\d{2}$/
    if (!monthRegex.test(monthParam)) {
      return NextResponse.json({ error: 'Invalid month format. Expected YYYY-MM' }, { status: 400 })
    }

    const [year, month] = monthParam.split('-').map(Number)

    if (year < 2020 || year > 2030 || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month value' }, { status: 400 })
    }

    const targetDate = new Date(year, month - 1, 1)

    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const monthStart = startOfMonth(targetDate)
    const monthEnd = endOfMonth(targetDate)

    const workTripRequests = await prisma.workTripRequest.findMany({
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

    let totalWorkTripDays = 0

    for (const request of workTripRequests) {
      const selectedDates = request.selectedDates as string[] | null

      if (selectedDates && selectedDates.length > 0) {
        const daysInMonth = selectedDates.filter(dateStr => {
          const date = new Date(dateStr)
          const dayOfWeek = getDay(date)
          return date >= monthStart && date <= monthEnd && dayOfWeek !== 0 && dayOfWeek !== 6
        })
        totalWorkTripDays += daysInMonth.length
      } else {
        const requestStart = request.startDate > monthStart ? request.startDate : monthStart
        const requestEnd = request.endDate < monthEnd ? request.endDate : monthEnd

        if (requestStart <= requestEnd) {
          const days = eachDayOfInterval({ start: requestStart, end: requestEnd })
          const businessDays = days.filter(day => {
            const dayOfWeek = getDay(day)
            return dayOfWeek !== 0 && dayOfWeek !== 6
          })
          totalWorkTripDays += businessDays.length
        }
      }
    }

    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const workingDaysInMonth = allDaysInMonth.filter(day => {
      const dayOfWeek = getDay(day)
      return dayOfWeek !== 0 && dayOfWeek !== 6
    }).length

    const percentage = workingDaysInMonth > 0 ? Math.round((totalWorkTripDays / workingDaysInMonth) * 100) : 0

    const workTripStats = {
      monthKey: monthParam,
      daysUsed: totalWorkTripDays,
      workingDaysInMonth,
      percentage,
      monthName: format(targetDate, 'MMMM yyyy')
    }

    return NextResponse.json(workTripStats)
  } catch (error) {
    console.error('Error fetching work trip stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch work trip statistics' },
      { status: 500 }
    )
  }
}
