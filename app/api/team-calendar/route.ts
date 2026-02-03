import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')

    // Validate parameters
    if (!yearParam || !monthParam) {
      return NextResponse.json({ error: 'Year and month parameters required' }, { status: 400 })
    }

    const year = parseInt(yearParam)
    const [monthYear, monthIndex] = monthParam.split('-').map(Number)

    if (isNaN(year) || isNaN(monthYear) || isNaN(monthIndex)) {
      return NextResponse.json({ error: 'Invalid year or month format' }, { status: 400 })
    }

    // Get current user info to determine team scope
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user?.id },
      select: { 
        role: true, 
        department: true, 
        managerId: true,
        departmentDirectorId: true,
        id: true
      }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine which team members to show based on role
    let teamMembersQuery: any = {
      isActive: true
    }

    if (currentUser.role === 'EMPLOYEE') {
      // Employees see their department colleagues
      teamMembersQuery.department = currentUser.department
    } else if (currentUser.role === 'MANAGER') {
      // Managers see their direct reports + department colleagues
      teamMembersQuery.OR = [
        { managerId: currentUser.id },
        { department: currentUser.department }
      ]
    } else if (currentUser.role === 'DIRECTOR') {
      // Directors see all users where they are the department director
      teamMembersQuery.departmentDirectorId = currentUser.id
    } else if (['HR', 'EXECUTIVE', 'ADMIN'].includes(currentUser.role)) {
      // HR, Executives, and Admins see everyone
      // No additional filter needed
    } else {
      // Default to department view
      teamMembersQuery.department = currentUser.department
    }

    // Get team members with their holiday plans
    const teamMembers = await prisma.user.findMany({
      where: teamMembersQuery,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        department: true,
        holidayPlans: {
          where: { 
            year,
            status: { in: ['SUBMITTED', 'REVIEWED', 'FINALIZED'] } // Only show submitted/approved plans
          },
          include: {
            dates: {
              where: {
                // Filter dates to the requested month (with some buffer for planning)
                date: {
                  gte: new Date(year, 0, 1), // Start of year
                  lte: new Date(year, 11, 31) // End of year
                }
              },
              select: {
                date: true,
                priority: true,
                reason: true
              }
            }
          }
        }
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    // Transform the data for the frontend
    const teamCalendarData = teamMembers.map(member => {
      const holidays = member.holidayPlans.length > 0 
        ? member.holidayPlans[0].dates.map(date => ({
            date: format(date.date, 'yyyy-MM-dd'),
            priority: date.priority,
            reason: date.reason
          }))
        : []

      return {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        position: member.position || 'Not specified',
        department: member.department,
        holidays
      }
    })

    // Calculate some summary statistics
    const totalMembers = teamCalendarData.length
    const membersWithPlans = teamCalendarData.filter(member => member.holidays.length > 0).length
    const planningCoverage = totalMembers > 0 ? (membersWithPlans / totalMembers) * 100 : 0

    // Get date range conflicts for the month
    const requestedMonth = new Date(monthYear, monthIndex - 1, 1)
    const monthStart = startOfMonth(requestedMonth)
    const monthEnd = endOfMonth(requestedMonth)

    // Calculate conflicts for the month
    const conflicts = await calculateMonthlyConflicts(teamCalendarData, monthStart, monthEnd)

    return NextResponse.json({
      teamMembers: teamCalendarData,
      summary: {
        totalMembers,
        membersWithPlans,
        planningCoverage,
        conflicts: conflicts.length
      },
      month: format(requestedMonth, 'yyyy-MM'),
      conflicts
    })

  } catch (error) {
    console.error('Error fetching team calendar:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team calendar data' },
      { status: 500 }
    )
  }
}

/**
 * Calculate conflicts for a given month
 */
async function calculateMonthlyConflicts(
  teamMembers: any[],
  monthStart: Date,
  monthEnd: Date
) {
  const dateMap: { [key: string]: any[] } = {}

  // Build date map
  teamMembers.forEach(member => {
    member.holidays.forEach((holiday: any) => {
      const holidayDate = new Date(holiday.date)
      if (holidayDate >= monthStart && holidayDate <= monthEnd) {
        const dateKey = holiday.date
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = []
        }
        dateMap[dateKey].push({
          member,
          priority: holiday.priority,
          reason: holiday.reason
        })
      }
    })
  })

  // Find conflicts (multiple people on same date)
  const conflicts = Object.entries(dateMap)
    .filter(([date, people]) => people.length > 1)
    .map(([date, people]) => ({
      date,
      people,
      conflictLevel: calculateConflictLevel(people),
      count: people.length
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return conflicts
}

/**
 * Calculate conflict severity
 */
function calculateConflictLevel(people: any[]): 'HIGH' | 'MEDIUM' | 'LOW' {
  const essentialCount = people.filter(p => p.priority === 'ESSENTIAL').length
  const preferredCount = people.filter(p => p.priority === 'PREFERRED').length
  
  if (essentialCount > 1) return 'HIGH'
  if (essentialCount === 1 && preferredCount > 0) return 'MEDIUM'
  if (people.length >= 4) return 'HIGH'
  if (people.length >= 3) return 'MEDIUM'
  return 'LOW'
}