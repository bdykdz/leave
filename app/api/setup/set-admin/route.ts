import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSetupAuth, checkSetupNotComplete } from '@/lib/setup-auth'

export async function POST(request: NextRequest) {
  const authError = await validateSetupAuth()
  if (authError) return authError

  const setupComplete = await checkSetupNotComplete()
  if (setupComplete) return setupComplete

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

    console.log(`Admin role assigned to user ID: ${updatedUser.id}`)

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
