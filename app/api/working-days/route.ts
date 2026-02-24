import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { WorkingDaysService } from '@/lib/services/working-days-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const parsedStart = new Date(startDate)
    const parsedEnd = new Date(endDate)

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (parsedEnd < parsedStart) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    // Cap date range to prevent DoS via eachDayOfInterval memory exhaustion
    const daySpan = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60 * 24))
    if (daySpan > 366) {
      return NextResponse.json({ error: 'Date range cannot exceed 366 days' }, { status: 400 })
    }

    const workingDaysService = WorkingDaysService.getInstance()
    const breakdown = await workingDaysService.getWorkingDaysBreakdown(parsedStart, parsedEnd)

    return NextResponse.json({
      workingDays: breakdown.workingDays,
      totalDays: breakdown.totalDays,
      weekends: breakdown.weekends,
      holidays: breakdown.holidays,
    })
  } catch (error) {
    console.error('Error calculating working days:', error)
    return NextResponse.json({ error: 'Failed to calculate working days' }, { status: 500 })
  }
}
