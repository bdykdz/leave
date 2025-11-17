import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { ConflictResolutionService } from '@/lib/services/conflict-resolution-service'
import { CacheService } from '@/lib/services/cache-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { managerId, requestedDates, excludeRequestId } = body

    // Validate input
    if (!managerId || !requestedDates || !Array.isArray(requestedDates)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Convert date strings to Date objects
    const dates = requestedDates.map(dateStr => new Date(dateStr))

    // Validate dates
    if (dates.some(date => isNaN(date.getTime()))) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Validate reasonable number of dates (max 30 days)
    if (dates.length > 30) {
      return NextResponse.json({ error: 'Cannot analyze more than 30 dates at once' }, { status: 400 })
    }

    // Check for duplicate dates and sort them
    const uniqueDates = dates.filter((date, index, self) => 
      index === self.findIndex(d => d.toDateString() === date.toDateString())
    ).sort((a, b) => a.getTime() - b.getTime())

    // Check cache first
    const cacheKey = `${managerId}:${dates.map(d => d.toISOString().split('T')[0]).join('-')}:${excludeRequestId || 'new'}`
    const cachedResult = await CacheService.getHolidayPlanCache(cacheKey)
    if (cachedResult) {
      return NextResponse.json(cachedResult)
    }

    // Analyze conflicts using the service
    const resolution = await ConflictResolutionService.analyzeConflicts(
      managerId,
      uniqueDates,
      excludeRequestId
    )

    // Cache the result for 10 minutes
    await CacheService.setHolidayPlanCache(cacheKey, resolution)

    return NextResponse.json(resolution)

  } catch (error) {
    console.error('Error in conflict analysis:', error)
    return NextResponse.json(
      { error: 'Failed to analyze conflicts' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const managerId = searchParams.get('managerId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!managerId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (end <= start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    // Validate reasonable date range (max 1 year)
    const daysDifference = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDifference > 365) {
      return NextResponse.json({ error: 'Date range cannot exceed 1 year' }, { status: 400 })
    }

    // Get team availability for the date range
    const availability = await ConflictResolutionService.getTeamAvailability(
      managerId,
      start,
      end
    )

    return NextResponse.json(availability)

  } catch (error) {
    console.error('Error fetching team availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team availability' },
      { status: 500 }
    )
  }
}