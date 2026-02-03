import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { HolidayPlanningService } from '@/lib/services/holiday-planning'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a manager or director
    const user = await prisma.user.findUnique({
      where: { id: session.user?.id },
      select: { role: true, id: true, department: true }
    })

    if (!user || !['MANAGER', 'DIRECTOR', 'EXECUTIVE'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get year parameter
    const url = new URL(request.url)
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear() + 1))

    // Determine if user is department director
    const isDepartmentDirector = user.role === 'DIRECTOR' || user.role === 'EXECUTIVE'

    // Get overlaps and gaps analysis
    const analysis = await HolidayPlanningService.detectOverlapsAndGaps(
      user.id, 
      year, 
      isDepartmentDirector
    )

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error fetching overlap analysis:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overlap analysis' },
      { status: 500 }
    )
  }
}