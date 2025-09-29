import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  // Check if user is authenticated for setup
  const setupAuth = (await cookies()).get('setup-auth')
  if (!setupAuth?.value) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Update the user's role to ADMIN
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    })

    console.log(`Admin role assigned to user: ${updatedUser.email}`)

    return NextResponse.json({
      message: 'Administrator role assigned successfully',
      user: updatedUser
    })
  } catch (error) {
    console.error('Error setting admin:', error)
    return NextResponse.json(
      { error: 'Failed to set administrator' },
      { status: 500 }
    )
  }
}