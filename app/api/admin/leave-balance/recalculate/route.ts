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
      select: { id: true, email: true, startDate: true }
    });

    // Recalculate balances for each user
    for (const user of users) {
      try {
        // Delete existing balances for current year
        await prisma.leaveBalance.deleteMany({
          where: {
            userId: user.id,
            year: currentYear
          }
        });

        // Re-initialize balances
        await balanceService.initializeUserBalances(
          user.id, 
          user.startDate || new Date()
        );

        processedCount++;
      } catch (error) {
        const errorMessage = `Failed to recalculate balance for ${user.email}: ${error}`;
        errors.push(errorMessage);
        console.error(errorMessage);
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BALANCE_RECALCULATION',
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