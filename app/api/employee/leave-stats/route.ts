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

    // Get all approved leave requests for the user that overlap this month
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart }
      },
      select: {
        startDate: true,
        endDate: true,
        selectedDates: true,
        supportingDocuments: true,
        leaveType: {
          select: { name: true, code: true }
        }
      }
    })

    const isBusinessDay = (date: Date) => {
      const dayOfWeek = getDay(date)
      return dayOfWeek !== 0 && dayOfWeek !== 6
    }

    // Collect the actual leave dates in this month, grouped by leave type
    const byType = new Map<string, { name: string; code: string; dates: Set<string> }>()

    for (const request of leaveRequests) {
      // Prefer the selectedDates column; older requests stored them in supportingDocuments JSON
      const docs = request.supportingDocuments as { selectedDates?: string[] } | null
      const rawSelected: (Date | string)[] =
        request.selectedDates && request.selectedDates.length > 0
          ? request.selectedDates
          : docs?.selectedDates || []

      let datesInMonth: Date[]
      if (rawSelected.length > 0) {
        datesInMonth = rawSelected
          .map(d => new Date(d))
          .filter(date => date >= monthStart && date <= monthEnd && isBusinessDay(date))
      } else {
        // Fallback: every business day in the startDate-endDate range, clipped to the month
        const requestStart = request.startDate > monthStart ? request.startDate : monthStart
        const requestEnd = request.endDate < monthEnd ? request.endDate : monthEnd
        datesInMonth = requestStart <= requestEnd
          ? eachDayOfInterval({ start: requestStart, end: requestEnd }).filter(isBusinessDay)
          : []
      }

      if (datesInMonth.length === 0) continue

      const typeName = request.leaveType?.name || 'Leave'
      const typeCode = request.leaveType?.code || 'LEAVE'
      const entry = byType.get(typeName) || { name: typeName, code: typeCode, dates: new Set<string>() }
      for (const date of datesInMonth) {
        entry.dates.add(format(date, 'yyyy-MM-dd'))
      }
      byType.set(typeName, entry)
    }

    const types = Array.from(byType.values())
      .map(entry => ({
        name: entry.name,
        code: entry.code,
        days: entry.dates.size,
        dates: Array.from(entry.dates).sort()
      }))
      .sort((a, b) => b.days - a.days)

    // Distinct leave dates across all types (a day can't be double-counted in the meter)
    const allDates = Array.from(new Set(types.flatMap(t => t.dates))).sort()
    const daysUsed = allDates.length

    // Calculate total working days in the month (excluding weekends)
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const workingDaysInMonth = allDaysInMonth.filter(isBusinessDay).length

    const percentage = workingDaysInMonth > 0 ? Math.round((daysUsed / workingDaysInMonth) * 100) : 0

    return NextResponse.json({
      monthKey: monthParam,
      daysUsed,
      workingDaysInMonth,
      percentage,
      monthName: format(targetDate, 'MMMM yyyy'),
      dates: allDates,
      byType: types
    })
  } catch (error) {
    console.error('Error fetching leave stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave statistics' },
      { status: 500 }
    )
  }
}
