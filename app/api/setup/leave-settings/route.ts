import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  // Check admin authentication
  const cookieStore = await cookies()
  const isAuthenticated = cookieStore.get('setup-auth')?.value === 'true'
  
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { normalLeaveDays } = await request.json()

    // Save to company settings
    await prisma.companySetting.upsert({
      where: { key: 'default_leave_days' },
      update: {
        value: { normalLeaveDays },
        updatedAt: new Date()
      },
      create: {
        key: 'default_leave_days',
        value: { normalLeaveDays },
        category: 'leave',
        description: 'Default leave days for new employees'
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving leave settings:', error)
    return NextResponse.json(
      { error: 'Failed to save leave settings' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Check admin authentication
  const cookieStore = await cookies()
  const isAuthenticated = cookieStore.get('setup-auth')?.value === 'true'
  
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const setting = await prisma.companySetting.findUnique({
      where: { key: 'default_leave_days' }
    })

    return NextResponse.json({
      normalLeaveDays: (setting?.value as any)?.normalLeaveDays || 21
    })
  } catch (error) {
    console.error('Error fetching leave settings:', error)
    return NextResponse.json({
      normalLeaveDays: 21
    })
  }
}