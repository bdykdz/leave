import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { AuditService } from '@/lib/services/audit-service'

export const dynamic = 'force-dynamic'

const singleEntrySchema = z.object({
  mode: z.literal('single'),
  userId: z.string(),
  year: z.number().int().min(2020).max(new Date().getFullYear()),
  entitled: z.number().min(0).max(365),
  used: z.number().min(0).max(365),
})

const bulkEntrySchema = z.object({
  mode: z.literal('bulk'),
  entries: z.array(z.object({
    employeeId: z.string(),
    year: z.number().int().min(2020).max(new Date().getFullYear()),
    entitled: z.number().min(0).max(365),
    used: z.number().min(0).max(365),
  })),
})

const importSchema = z.discriminatedUnion('mode', [singleEntrySchema, bulkEntrySchema])

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
    const userId = searchParams.get('userId')
    const yearsParam = searchParams.get('years')
    const yearParam = searchParams.get('year')

    // Find NL leave type
    const nlLeaveType = await prisma.leaveType.findFirst({
      where: { code: 'NL' }
    })

    if (!nlLeaveType) {
      return NextResponse.json({ error: 'Normal Leave (NL) leave type not found' }, { status: 404 })
    }

    const where: any = { leaveTypeId: nlLeaveType.id }

    if (userId) {
      where.userId = userId
    }

    if (yearsParam) {
      const years = yearsParam.split(',').map(Number).filter(y => !isNaN(y))
      where.year = { in: years }
    } else if (yearParam) {
      where.year = parseInt(yearParam)
    }

    const balances = await prisma.leaveBalance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            isActive: true,
          }
        },
        leaveType: {
          select: { name: true, code: true, maxCarryForward: true }
        }
      },
      orderBy: [{ user: { lastName: 'asc' } }, { year: 'asc' }]
    })

    return NextResponse.json({ balances })
  } catch (error) {
    console.error('Error fetching historical balances:', error)
    return NextResponse.json({ error: 'Failed to fetch historical balances' }, { status: 500 })
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
    const parsed = importSchema.parse(body)

    // Find NL leave type
    const nlLeaveType = await prisma.leaveType.findFirst({
      where: { code: 'NL' }
    })

    if (!nlLeaveType) {
      return NextResponse.json({ error: 'Normal Leave (NL) leave type not found' }, { status: 404 })
    }

    let created = 0
    let updated = 0
    const errors: string[] = []

    if (parsed.mode === 'single') {
      const { userId, year, entitled, used } = parsed

      // Verify user exists
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const existing = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: { userId, leaveTypeId: nlLeaveType.id, year }
        }
      })

      // Preserve existing carriedForward and pending if balance already exists
      const existingCF = existing?.carriedForward || 0
      const existingPending = existing?.pending || 0

      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: { userId, leaveTypeId: nlLeaveType.id, year }
        },
        update: {
          entitled,
          used,
          available: entitled + existingCF - used - existingPending,
          updatedAt: new Date()
        },
        create: {
          userId,
          leaveTypeId: nlLeaveType.id,
          year,
          entitled,
          used,
          carriedForward: 0,
          available: entitled - used,
          pending: 0
        }
      })

      if (existing) updated++
      else created++
    } else {
      // Bulk import — validate all entries first, then apply in a transaction
      const validEntries: Array<{ user: { id: string }; entry: typeof parsed.entries[0]; existing: any }> = []

      for (const entry of parsed.entries) {
        const user = await prisma.user.findUnique({
          where: { employeeId: entry.employeeId }
        })

        if (!user) {
          errors.push(`Employee ${entry.employeeId}: User not found`)
          continue
        }

        const existing = await prisma.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: { userId: user.id, leaveTypeId: nlLeaveType.id, year: entry.year }
          }
        })

        validEntries.push({ user, entry, existing })
      }

      // Apply all valid entries in a single transaction
      if (validEntries.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const { user, entry, existing } of validEntries) {
            const existingCF = existing?.carriedForward || 0
            const existingPending = existing?.pending || 0

            await tx.leaveBalance.upsert({
              where: {
                userId_leaveTypeId_year: { userId: user.id, leaveTypeId: nlLeaveType.id, year: entry.year }
              },
              update: {
                entitled: entry.entitled,
                used: entry.used,
                available: entry.entitled + existingCF - entry.used - existingPending,
                updatedAt: new Date()
              },
              create: {
                userId: user.id,
                leaveTypeId: nlLeaveType.id,
                year: entry.year,
                entitled: entry.entitled,
                used: entry.used,
                carriedForward: 0,
                available: entry.entitled - entry.used,
                pending: 0
              }
            })

            if (existing) updated++
            else created++
          }
        })
      }
    }

    // Audit log
    await AuditService.log({
      action: 'UPDATE',
      entityType: 'LeaveBalance',
      entityId: 'HISTORICAL_IMPORT',
      userId: session.user.id,
      details: {
        actionType: 'HISTORICAL_BALANCE_IMPORT',
        mode: parsed.mode,
        created,
        updated,
        errorCount: errors.length,
        triggeredBy: session.user.email,
      }
    })

    return NextResponse.json({ created, updated, errors })
  } catch (error: any) {
    console.error('Error importing historical balances:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Failed to import historical balances' }, { status: 500 })
  }
}
