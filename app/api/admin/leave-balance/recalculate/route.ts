import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { LeaveBalanceService } from '@/lib/services/leave-balance-service';
import { canModifySystemSettings } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || !canModifySystemSettings(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const balanceService = LeaveBalanceService.getInstance();
    const currentYear = new Date().getFullYear();
    let processedCount = 0;
    const errors: string[] = [];

    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true }
    });

    // Get all leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true }
    });

    // Recalculate balances for each user (preserving carriedForward)
    for (const u of users) {
      try {
        for (const leaveType of leaveTypes) {
          const existing = await prisma.leaveBalance.findUnique({
            where: {
              userId_leaveTypeId_year: {
                userId: u.id,
                leaveTypeId: leaveType.id,
                year: currentYear
              }
            }
          });

          if (existing) {
            // Recalculate available from source fields (preserving carriedForward)
            const newAvailable = existing.entitled + existing.carriedForward - existing.used - existing.pending;
            await prisma.leaveBalance.update({
              where: { id: existing.id },
              data: { available: newAvailable }
            });
          } else {
            // Initialize missing balance
            let entitledDays = leaveType.daysAllowed || 0;
            await prisma.leaveBalance.create({
              data: {
                userId: u.id,
                leaveTypeId: leaveType.id,
                year: currentYear,
                entitled: entitledDays,
                available: entitledDays,
                used: 0,
                pending: 0,
                carriedForward: 0
              }
            });
          }
        }

        processedCount++;
      } catch (error) {
        const errorMessage = `Failed to recalculate balance for ${u.email}: ${error}`;
        errors.push(errorMessage);
        console.error(errorMessage);
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BALANCE_RECALCULATION',
        entity: 'LeaveBalance',
        entityType: 'LEAVE_BALANCE',
        entityId: 'ALL',
        details: {
          year: currentYear,
          processedUsers: processedCount,
          errorCount: errors.length,
          errors: errors,
          triggeredBy: session.user.email,
          timestamp: new Date()
        }
      }
    });

    return NextResponse.json({
      message: 'Leave balances recalculated successfully',
      processed: processedCount,
      errors: errors,
      year: currentYear
    });

  } catch (error) {
    console.error('Error recalculating leave balances:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate leave balances' },
      { status: 500 }
    );
  }
}