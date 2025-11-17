import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { LeaveRolloverService } from '@/lib/services/leave-rollover-service'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const rolloverSchema = z.object({
  fromYear: z.number().int().min(2020).max(2030),
  execute: z.boolean().optional().default(false)
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin/HR permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user?.id },
      select: { role: true }
    })

    if (!currentUser || !['HR', 'ADMIN', 'EXECUTIVE'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    
    if (!yearParam) {
      return NextResponse.json({ error: 'Year parameter is required' }, { status: 400 })
    }

    const fromYear = parseInt(yearParam)
    if (isNaN(fromYear)) {
      return NextResponse.json({ error: 'Invalid year format' }, { status: 400 })
    }

    // Get rollover preview
    const preview = await LeaveRolloverService.getRolloverPreview(fromYear)
    const isExecuted = await LeaveRolloverService.isRolloverExecuted(fromYear)

    return NextResponse.json({
      ...preview,
      isExecuted,
      fromYear,
      toYear: fromYear + 1
    })

  } catch (error) {
    console.error('Error fetching rollover data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rollover data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin/HR permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user?.id },
      select: { role: true }
    })

    if (!currentUser || !['HR', 'ADMIN', 'EXECUTIVE'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { fromYear, execute } = rolloverSchema.parse(body)

    if (!execute) {
      // Just return preview
      const preview = await LeaveRolloverService.getRolloverPreview(fromYear)
      return NextResponse.json(preview)
    }

    // Check if rollover has already been executed
    const isExecuted = await LeaveRolloverService.isRolloverExecuted(fromYear)
    if (isExecuted) {
      return NextResponse.json(
        { error: 'Rollover has already been executed for this year' },
        { status: 400 }
      )
    }

    // Execute the rollover
    const result = await LeaveRolloverService.executeBulkRollover(fromYear, session.user?.id)

    return NextResponse.json({
      message: 'Rollover executed successfully',
      ...result
    })

  } catch (error: any) {
    console.error('Error executing rollover:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to execute rollover' },
      { status: 500 }
    )
  }
}