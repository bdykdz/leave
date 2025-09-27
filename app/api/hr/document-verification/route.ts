import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['HR', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all leave requests that require HR document verification
    const requests = await prisma.leaveRequest.findMany({
      where: {
        leaveType: {
          requiresHRVerification: true,
        },
        status: 'PENDING',
        supportingDocuments: {
          not: null,
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true,
          },
        },
        leaveType: {
          select: {
            name: true,
            code: true,
            documentTypes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
    })

    // Transform supportingDocuments from JSON to array
    const transformedRequests = requests.map(request => ({
      ...request,
      supportingDocuments: (request.supportingDocuments as string[]) || [],
    }))

    return NextResponse.json({ requests: transformedRequests })
  } catch (error) {
    console.error('Failed to fetch verification requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch verification requests' },
      { status: 500 }
    )
  }
}