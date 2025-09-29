import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // Check if user is authenticated for setup
  const setupAuth = (await cookies()).get('setup-auth')
  if (!setupAuth?.value) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Fetch all users from the database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        employeeId: true,
        department: true,
        position: true,
        createdAt: true
      },
      orderBy: {
        firstName: 'asc'
      }
    })

    // Format users for display
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      displayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      role: user.role,
      employeeId: user.employeeId,
      department: user.department,
      position: user.position,
      createdAt: user.createdAt
    }))

    return NextResponse.json({
      users: formattedUsers,
      count: formattedUsers.length
    })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch users',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    )
  }
}