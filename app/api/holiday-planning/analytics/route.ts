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

    // Safely extract parameters
    let type: string | null = null
    let year: number = new Date().getFullYear()
    let userId: string = session.user?.id || ''

    try {
      const url = new URL(request.url)
      type = url.searchParams.get('type')
      const yearParam = url.searchParams.get('year')
      const userIdParam = url.searchParams.get('userId')
      
      if (yearParam) year = parseInt(yearParam)
      if (userIdParam) userId = userIdParam
    } catch {
      // Use defaults if URL parsing fails
    }

    if (type === 'planned-vs-actual') {
      // Check permission: users can see their own, managers can see their team's
      if (userId !== session.user?.id && 
          !['MANAGER', 'DEPARTMENT_DIRECTOR', 'HR', 'EXECUTIVE', 'ADMIN'].includes(session.user?.role || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      const analysis = await HolidayPlanningService.getPlannedVsActual(userId, year)
      return NextResponse.json(analysis)
    }

    if (type === 'department-overview') {
      if (!['MANAGER', 'DEPARTMENT_DIRECTOR', 'HR', 'EXECUTIVE', 'ADMIN'].includes(session.user?.role || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      let department: string
      try {
        const url = new URL(request.url)
        department = url.searchParams.get('department') || session.user?.department || ''
      } catch {
        department = session.user?.department || ''
      }

      const plans = await HolidayPlanningService.getDepartmentPlans(department, year)
      
      // Calculate statistics
      const stats = {
        totalEmployees: plans.length,
        withPlans: plans.filter(u => u.holidayPlans.length > 0).length,
        submitted: plans.filter(u => 
          u.holidayPlans.some(p => p.status !== 'DRAFT')
        ).length,
        totalPlannedDays: plans.reduce((sum, u) => 
          sum + u.holidayPlans.reduce((pSum, p) => pSum + p.dates.length, 0), 0
        ),
        averageDaysPerPerson: 0
      }
      
      if (stats.withPlans > 0) {
        stats.averageDaysPerPerson = stats.totalPlannedDays / stats.withPlans
      }

      return NextResponse.json({
        department,
        year,
        stats,
        plans: plans.map(u => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          plan: u.holidayPlans[0] || null
        }))
      })
    }

    return NextResponse.json(
      { error: 'Invalid analytics type' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}