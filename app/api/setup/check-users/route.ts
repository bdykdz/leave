import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSetupAuth } from '@/lib/setup-auth'

export async function GET(request: NextRequest) {
  const authError = await validateSetupAuth()
  if (authError) return authError

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
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
