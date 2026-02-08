import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// Get team holiday plans for managers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a manager
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

    // Get subordinates' holiday plans
    let holidayPlans = []

    if (user.role === 'MANAGER') {
      // Get direct reports' plans
      holidayPlans = await prisma.holidayPlan.findMany({
        where: {
          year,
          user: {
            managerId: user.id,
            isActive: true
          }
        },
        include: {
          dates: {
            orderBy: { date: 'asc' }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              department: true,
              position: true
            }
          }
        },
        orderBy: [
          { status: 'asc' },
          { submittedAt: 'desc' }
        ]
      })
    } else if (user.role === 'DIRECTOR') {
      // Get all users where this director is the departmentDirectorId (handles multi-department directors)
      holidayPlans = await prisma.holidayPlan.findMany({
        where: {
          year,
          user: {
            departmentDirectorId: user.id,
            isActive: true
          }
        },
        include: {
          dates: {
            orderBy: { date: 'asc' }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              department: true,
              position: true
            }
          }
        },
        orderBy: [
          { status: 'asc' },
          { submittedAt: 'desc' }
        ]
      })
    } else {
      // Executives can see all plans
      holidayPlans = await prisma.holidayPlan.findMany({
        where: { year },
        include: {
          dates: {
            orderBy: { date: 'asc' }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              department: true,
              position: true
            }
          }
        },
        orderBy: [
          { status: 'asc' },
          { submittedAt: 'desc' }
        ]
      })
    }

    // Ensure dates are properly serialized for JSON response
    const serializedPlans = holidayPlans.map(plan => ({
      ...plan,
      dates: plan.dates.map(date => ({
        ...date,
        date: date.date.toISOString()
      }))
    }))

    console.log('Team plans - total plans:', serializedPlans.length)
    serializedPlans.forEach((plan, index) => {
      console.log(`Plan ${index}: ${plan.user?.firstName} ${plan.user?.lastName} - ${plan.dates.length} dates`)
    })

    return NextResponse.json({ holidayPlans: serializedPlans })
  } catch (error) {
    console.error('Error fetching team holiday plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team holiday plans' },
      { status: 500 }
    )
  }
}