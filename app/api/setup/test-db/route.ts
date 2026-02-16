import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSetupAuth } from '@/lib/setup-auth'

export async function GET() {
  // Require setup auth — this endpoint previously had NO auth
  const authError = await validateSetupAuth()
  if (authError) return authError

  try {
    // Simple count query
    const userCount = await prisma.user.count()

    return NextResponse.json({
      success: true,
      userCount,
      message: `Database connected. Found ${userCount} users.`
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Database connection failed'
    }, { status: 500 })
  }
}
