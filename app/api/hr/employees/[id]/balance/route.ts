import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only HR and ADMIN can modify balances
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, department: true }
    })

    if (!user || !['HR', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { annual, sick } = await request.json()

    // Validate input types
    if (typeof annual !== 'number' || typeof sick !== 'number') {
      return NextResponse.json(
        { error: 'Balance values must be numbers' },
        { status: 400 }
      )
    }

    // Validate input - no negative values
    if (annual < 0 || sick < 0) {
      return NextResponse.json(
        { error: 'Balance values cannot be negative' },
        { status: 400 }
      )
    }

    const currentYear = new Date().getFullYear()

    // Get leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        code: { in: ['NL', 'SL'] }
      }
    })

    const annualLeaveType = leaveTypes.find(lt => lt.code === 'NL')
    const sickLeaveType = leaveTypes.find(lt => lt.code === 'SL')

    // Update balances using transaction
    await prisma.$transaction(async (tx) => {
      // Update normal leave balance
      if (annualLeaveType) {
        // Get existing balance to preserve used/pending
        const existing = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: params.id,
              leaveTypeId: annualLeaveType.id,
              year: currentYear
            }
          }
        })

        const used = existing?.used || 0
        const pending = existing?.pending || 0

        await tx.leaveBalance.upsert({
          where: {
            userId_leaveTypeId_year: {
              userId: params.id,
              leaveTypeId: annualLeaveType.id,
              year: currentYear
            }
          },
          update: {
            entitled: annual,
            available: Math.max(0, annual + (existing?.carriedForward || 0) - used - pending) // Recalculate available
          },
          create: {
            userId: params.id,
            leaveTypeId: annualLeaveType.id,
            year: currentYear,
            entitled: annual,
            used: 0,
            pending: 0,
            available: annual
          }
        })
      }

      // Update sick leave balance
      if (sickLeaveType) {
        // Get existing balance to preserve used/pending
        const existing = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: params.id,
              leaveTypeId: sickLeaveType.id,
              year: currentYear
            }
          }
        })

        const used = existing?.used || 0
        const pending = existing?.pending || 0

        await tx.leaveBalance.upsert({
          where: {
            userId_leaveTypeId_year: {
              userId: params.id,
              leaveTypeId: sickLeaveType.id,
              year: currentYear
            }
          },
          update: {
            entitled: sick,
            available: Math.max(0, sick + (existing?.carriedForward || 0) - used - pending) // Recalculate available
          },
          create: {
            userId: params.id,
            leaveTypeId: sickLeaveType.id,
            year: currentYear,
            entitled: sick,
            used: 0,
            pending: 0,
            available: sick
          }
        })
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_LEAVE_BALANCE',
          entityType: 'LEAVE_BALANCE',
          entityId: params.id,
          details: {
            updatedBy: session.user.email,
            newBalances: { annual, sick },
            year: currentYear
          }
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Leave balances updated successfully'
    })
  } catch (error) {
    console.error('Error updating leave balance:', error)
    return NextResponse.json(
      { error: 'Failed to update leave balance' },
      { status: 500 }
    )
  }
}
