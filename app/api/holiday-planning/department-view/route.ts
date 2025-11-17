import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// Get department-wide holiday plans (read-only view for all employees)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's department
    const user = await prisma.user.findUnique({
      where: { id: session.user?.id },
      select: { department: true, role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get year parameter
    const url = new URL(request.url)
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear() + 1))

    // Get all holiday plans from the same department
    const departmentPlans = await prisma.holidayPlan.findMany({
      where: {
        year,
        user: {
          department: user.department,
          isActive: true
        },
        // Only show submitted/approved plans for transparency
        status: {
          in: ['SUBMITTED', 'REVIEWED', 'FINALIZED']
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
            employeeId: true,
            department: true,
            position: true,
            role: true
          }
        }
      },
      orderBy: [
        { user: { role: 'asc' } }, // Executives/Directors first
        { user: { lastName: 'asc' } },
        { user: { firstName: 'asc' } }
      ]
    })

    // Get department summary
    const departmentMembers = await prisma.user.count({
      where: {
        department: user.department,
        isActive: true
      }
    })

    const membersWithPlans = await prisma.user.count({
      where: {
        department: user.department,
        isActive: true,
        holidayPlans: {
          some: {
            year,
            status: {
              in: ['SUBMITTED', 'REVIEWED', 'FINALIZED']
            }
          }
        }
      }
    })

    // Ensure dates are properly serialized for JSON response
    const serializedDeptPlans = departmentPlans.map(plan => ({
      ...plan,
      dates: plan.dates.map(date => ({
        ...date,
        date: date.date.toISOString()
      }))
    }))

    console.log('Department view - total plans:', serializedDeptPlans.length)
    serializedDeptPlans.forEach((plan, index) => {
      console.log(`Dept Plan ${index}: ${plan.user?.firstName} ${plan.user?.lastName} - ${plan.dates.length} dates`)
    })

    return NextResponse.json({ 
      departmentPlans: serializedDeptPlans,
      department: user.department,
      summary: {
        totalMembers: departmentMembers,
        membersWithPlans,
        planningCoverage: departmentMembers > 0 ? (membersWithPlans / departmentMembers) * 100 : 0
      }
    })
  } catch (error) {
    console.error('Error fetching department holiday plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch department holiday plans' },
      { status: 500 }
    )
  }
}