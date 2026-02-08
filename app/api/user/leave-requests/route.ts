import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's leave requests
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        // Only return pending and approved requests for conflict checking
        status: {
          in: ['PENDING', 'APPROVED']
        }
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        selectedDates: true,
        status: true,
        leaveType: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    })

    // Transform the data to match the expected format
    const transformedRequests = leaveRequests.map(request => ({
      id: request.id,
      startDate: request.startDate.toISOString().split('T')[0], // YYYY-MM-DD format
      endDate: request.endDate.toISOString().split('T')[0],
      selectedDates: request.selectedDates || [],
      status: request.status,
      leaveType: request.leaveType.name
    }))

    return NextResponse.json({ requests: transformedRequests })
  } catch (error) {
    console.error('Error fetching user leave requests:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}