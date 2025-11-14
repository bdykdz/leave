import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { HolidayPlanningService } from '@/lib/services/holiday-planning'
import { PlanPriority } from '@prisma/client'
import { createPlanSchema, submitPlanSchema, isPlanningWindowOpen } from '@/lib/validators/holiday-planning'
import { z } from 'zod'

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

    const plan = await HolidayPlanningService.getUserHolidayPlan(session.user?.id || '', year)
    
    // If no plan exists, return a minimal plan structure with window info
    if (!plan) {
      const window = await HolidayPlanningService.getCurrentPlanningWindow(year)
      return NextResponse.json({
        id: null,
        year,
        status: null,
        submittedAt: null,
        dates: [],
        window,
        user: null
      })
    }
    
    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error fetching user plan:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user plan' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if planning window is open
    if (!isPlanningWindowOpen()) {
      return NextResponse.json(
        { error: 'Planning window is closed. Planning is only available October through December.' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    
    let validatedData
    try {
      validatedData = createPlanSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        )
      }
      throw error
    }

    const { year, dates } = validatedData

    await HolidayPlanningService.createOrUpdateUserPlan(
      session.user?.id || '',
      year,
      dates
    )
    
    const updatedPlan = await HolidayPlanningService.getUserHolidayPlan(session.user?.id || '', year)
    
    return NextResponse.json(updatedPlan)
  } catch (error: any) {
    console.error('Error updating user plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user plan' },
      { status: error.message?.includes('not active') || error.message?.includes('locked') ? 400 : 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request
    const body = await request.json()
    
    let validatedData
    try {
      validatedData = submitPlanSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        )
      }
      throw error
    }

    const { year, action } = validatedData

    if (action === 'submit') {
      const plan = await HolidayPlanningService.submitPlan(session.user?.id || '', year)
      return NextResponse.json(plan)
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error updating plan status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update plan status' },
      { status: error.message?.includes('not in submission') ? 400 : 500 }
    )
  }
}