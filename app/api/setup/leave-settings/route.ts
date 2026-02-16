import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSetupAuth, checkSetupNotComplete } from '@/lib/setup-auth'

export async function POST(request: Request) {
  const authError = await validateSetupAuth()
  if (authError) return authError

  const setupComplete = await checkSetupNotComplete()
  if (setupComplete) return setupComplete

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
  const authError = await validateSetupAuth()
  if (authError) return authError

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
