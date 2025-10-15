import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only executives can access this endpoint
    if (session.user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 })
    }

    // Fetch other executives (excluding the current user)
    const executives = await prisma.user.findMany({
      where: {
        role: 'EXECUTIVE',
        isActive: true,
        id: {
          not: session.user.id // Exclude current user
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        role: true,
        position: true
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Transform the data to match the expected format
    const transformedExecutives = executives.map(exec => ({
      id: exec.id,
      name: `${exec.firstName} ${exec.lastName}`,
      email: exec.email,
      department: exec.department || 'Unknown Department',
      position: exec.position || 'Executive'
    }))

    return NextResponse.json({ 
      executives: transformedExecutives,
      count: transformedExecutives.length 
    })
  } catch (error) {
    console.error('Error fetching executive peers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}