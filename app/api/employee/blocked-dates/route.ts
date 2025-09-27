import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { eachDayOfInterval, format } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all leave requests for the user that are not rejected or cancelled
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        status: {
          in: ['PENDING', 'APPROVED'] // Include both pending and approved
        }
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
        leaveType: {
          select: {
            name: true
          }
        }
      }
    })

    // Convert leave requests to an array of blocked dates
    const blockedDates: string[] = []
    const dateDetails: Record<string, { status: string; leaveType: string; requestId: string }> = {}

    leaveRequests.forEach(request => {
      const days = eachDayOfInterval({
        start: new Date(request.startDate),
        end: new Date(request.endDate)
      })

      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        blockedDates.push(dateStr)
        dateDetails[dateStr] = {
          status: request.status,
          leaveType: request.leaveType.name,
          requestId: request.id
        }
      })
    })

    return NextResponse.json({
      blockedDates: [...new Set(blockedDates)], // Remove duplicates
      dateDetails,
      totalBlockedDays: blockedDates.length
    })
  } catch (error) {
    console.error('Error fetching blocked dates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blocked dates' },
      { status: 500 }
    )
  }
}