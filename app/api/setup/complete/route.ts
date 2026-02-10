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
    // Mark setup as complete
    await prisma.companySetting.upsert({
      where: { key: 'setup_complete' },
      update: { value: true },
      create: {
        key: 'setup_complete',
        value: true,
        category: 'system',
        description: 'Indicates if initial setup has been completed'
      }
    })

    // Clear setup auth cookie via response
    const response = NextResponse.json({ success: true })
    response.cookies.delete('setup-auth')

    return response
  } catch (error) {
    console.error('Failed to complete setup:', error)
    return NextResponse.json(
      { error: 'Failed to complete setup' },
      { status: 500 }
    )
  }
}