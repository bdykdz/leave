import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !['ADMIN', 'HR', 'EXECUTIVE'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId } = await params

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentYear = new Date().getFullYear()

    // Get all leave types
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { name: 'asc' }
    })

    // Get user's leave balances for current year
    const balances = await prisma.leaveBalance.findMany({
      where: {
        userId,
        year: currentYear
      },
      include: {
        leaveType: true
      }
    })

    // Create a map for easy lookup
    const balanceMap = new Map(
      balances.map(b => [b.leaveTypeId, b])
    )

    // Only show Normal Leave (NL) for balance management
    // Other leave types are tracked but not limited
    const leaveBalances = leaveTypes
      .filter(type => type.code === 'NL') // Only show Normal Leave for balance management
      .map(type => {
        const balance = balanceMap.get(type.id)
        return {
          leaveTypeId: type.id,
          leaveTypeName: type.name,
          leaveTypeCode: type.code,
          year: currentYear,
          entitled: balance?.entitled || 0,
          used: balance?.used || 0,
          pending: balance?.pending || 0,
          available: balance?.available || 0,
          carriedForward: balance?.carriedForward || 0,
          balanceId: balance?.id || null
        }
      })

    return NextResponse.json({ leaveBalances })
  } catch (error) {
    console.error('Error fetching leave balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave balances' },
      { status: 500 }
    )
  }
}

const updateBalanceSchema = z.object({
  leaveTypeId: z.string().min(1),
  year: z.number().int().min(2020).max(new Date().getFullYear() + 1),
  entitled: z.number().min(0).max(365),
  adjustment: z.number().min(-365).max(365).optional(),
  reason: z.string().max(500).optional()
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !['ADMIN', 'HR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId } = await params

    // Validate request body
    const body = await request.json()
    const parsed = updateBalanceSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { leaveTypeId, year, entitled, adjustment, reason } = parsed.data

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find or create the leave balance
    const existingBalance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId,
          year
        }
      }
    })

    let updatedBalance

    if (existingBalance) {
      // Update existing balance
      const newEntitled = adjustment ? existingBalance.entitled + adjustment : entitled
      const newAvailable = newEntitled + existingBalance.carriedForward - existingBalance.used - existingBalance.pending

      // Prevent setting entitled below already-used days
      if (newEntitled < existingBalance.used) {
        return NextResponse.json(
          { error: 'Entitled days cannot be less than already used days' },
          { status: 400 }
        )
      }

      updatedBalance = await prisma.leaveBalance.update({
        where: { id: existingBalance.id },
        data: {
          entitled: newEntitled,
          available: newAvailable
        },
        include: {
          leaveType: true
        }
      })
    } else {
      // Create new balance
      updatedBalance = await prisma.leaveBalance.create({
        data: {
          userId,
          leaveTypeId,
          year,
          entitled: entitled,
          available: entitled,
          used: 0,
          pending: 0,
          carriedForward: 0
        },
        include: {
          leaveType: true
        }
      })
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: existingBalance ? 'UPDATE_LEAVE_BALANCE' : 'CREATE_LEAVE_BALANCE',
        entity: 'LeaveBalance',
        entityId: updatedBalance.id,
        newValues: {
          targetUserId: userId,
          leaveTypeId,
          year,
          previousEntitled: existingBalance?.entitled,
          newEntitled: updatedBalance.entitled,
          adjustment,
          reason
        }
      }
    })

    return NextResponse.json({
      balance: updatedBalance,
      message: 'Leave balance updated successfully'
    })
  } catch (error) {
    console.error('Error updating leave balance:', error)
    return NextResponse.json(
      { error: 'Failed to update leave balance' },
      { status: 500 }
    )
  }
}
