import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { LeaveRolloverService } from '@/lib/services/leave-rollover-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const chainRolloverSchema = z.object({
  startYear: z.number().int().min(2020).max(new Date().getFullYear()),
  endYear: z.number().int().min(2020).max(new Date().getFullYear()),
}).refine(d => d.startYear < d.endYear, {
  message: 'startYear must be less than endYear',
  path: ['startYear'],
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['HR', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startYear = parseInt(searchParams.get('startYear') || '2023')
    const endYear = parseInt(searchParams.get('endYear') || '2025')

    if (isNaN(startYear) || isNaN(endYear) || startYear >= endYear) {
      return NextResponse.json({ error: 'Invalid year range' }, { status: 400 })
    }

    // Dry run - preview only
    const result = await LeaveRolloverService.executeChainRollover(
      startYear,
      endYear,
      session.user.id,
      true // dryRun
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error previewing chain rollover:', error)
    const safeMessage = error.message?.startsWith('Normal Leave')
      ? error.message
      : 'Failed to preview chain rollover'
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['HR', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = chainRolloverSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { startYear, endYear } = parsed.data

    // Check if chain rollover was already executed for this range
    const isExecuted = await LeaveRolloverService.isRolloverExecuted(startYear)
    if (isExecuted) {
      return NextResponse.json(
        { error: 'Rollover has already been executed covering this year range. Check audit logs for details.' },
        { status: 400 }
      )
    }

    const result = await LeaveRolloverService.executeChainRollover(
      startYear,
      endYear,
      session.user.id,
      false // execute for real
    )

    return NextResponse.json({
      message: 'Chain rollover executed successfully',
      ...result
    })
  } catch (error: any) {
    console.error('Error executing chain rollover:', error)
    const safeMessage = error.message?.startsWith('Normal Leave')
      ? error.message
      : 'Failed to execute chain rollover'
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 }
    )
  }
}
