import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR, ADMIN, EXECUTIVE, or EMPLOYEE with HR department
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    const isHREmployee = user?.role === 'EMPLOYEE' && user?.department?.toLowerCase().includes('hr')
    
    if (!user || (!['HR', 'ADMIN', 'EXECUTIVE'].includes(user.role) && !isHREmployee)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const currentDate = new Date()
    // Get leave events for current month plus/minus 2 months for calendar view
    const startDate = startOfMonth(subMonths(currentDate, 2))
    const endDate = endOfMonth(addMonths(currentDate, 2))

    // Get all approved leave requests in the date range
    const leaveEvents = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          {
            startDate: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            endDate: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: endDate } }
            ]
          }
        ]
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
            email: true
          }
        },
        leaveType: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    // Also get pending leave requests that might affect planning
    const pendingLeaveEvents = await prisma.leaveRequest.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        OR: [
          {
            startDate: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            endDate: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: endDate } }
            ]
          }
        ]
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
            email: true
          }
        },
        leaveType: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    // Format the data for the calendar component
    const formattedApprovedEvents = leaveEvents.map(event => ({
      id: event.id,
      employeeName: `${event.user.firstName} ${event.user.lastName}`,
      department: event.user.department || 'Unknown',
      leaveType: event.leaveType.name,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
      totalDays: event.totalDays,
      email: event.user.email
    }))

    const formattedPendingEvents = pendingLeaveEvents.map(event => ({
      id: event.id,
      employeeName: `${event.user.firstName} ${event.user.lastName}`,
      department: event.user.department || 'Unknown',
      leaveType: event.leaveType.name,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
      totalDays: event.totalDays,
      email: event.user.email
    }))

    return NextResponse.json({
      approvedEvents: formattedApprovedEvents,
      pendingEvents: formattedPendingEvents
    })
  } catch (error) {
    console.error('Error fetching leave calendar data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave calendar data' },
      { status: 500 }
    )
  }
}