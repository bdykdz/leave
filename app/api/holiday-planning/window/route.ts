import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { HolidayPlanningService } from '@/lib/services/holiday-planning'

// Prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Safely extract year parameter
    let year: number
    try {
      const url = new URL(request.url)
      const yearParam = url.searchParams.get('year')
      year = yearParam ? parseInt(yearParam) : new Date().getFullYear() + 1
    } catch {
      year = new Date().getFullYear() + 1
    }

    const window = await HolidayPlanningService.getCurrentPlanningWindow(year)
    
    if (!window) {
      // Create window if it doesn't exist
      await HolidayPlanningService.createOrUpdatePlanningWindow(year)
      const newWindow = await HolidayPlanningService.getCurrentPlanningWindow(year)
      return NextResponse.json(newWindow)
    }

    // Update stage based on current date
    await HolidayPlanningService.updatePlanningStage()
    
    // Fetch updated window
    const updatedWindow = await HolidayPlanningService.getCurrentPlanningWindow(year)
    
    return NextResponse.json(updatedWindow)
  } catch (error) {
    console.error('Error fetching planning window:', error)
    return NextResponse.json(
      { error: 'Failed to fetch planning window' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['HR', 'ADMIN'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { year } = await request.json()
    
    if (!year) {
      return NextResponse.json(
        { error: 'Year is required' },
        { status: 400 }
      )
    }

    const window = await HolidayPlanningService.createOrUpdatePlanningWindow(year, session.user.id)
    
    return NextResponse.json(window)
  } catch (error) {
    console.error('Error creating planning window:', error)
    return NextResponse.json(
      { error: 'Failed to create planning window' },
      { status: 500 }
    )
  }
}