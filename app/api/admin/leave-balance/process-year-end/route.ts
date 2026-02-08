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

    // Get the leave balance service instance
    const balanceService = LeaveBalanceService.getInstance();

    // Process year-end carry forward for all users
    const result = await balanceService.processYearEndCarryForward();

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'YEAR_END_PROCESSING_TRIGGERED',
        entityType: 'LEAVE_BALANCE',
        entityId: 'ALL',
        details: {
          processedUsers: result.processed,
          errorCount: result.errors.length,
          errors: result.errors,
          triggeredBy: session.user.email,
          timestamp: new Date()
        }
      }
    });

    return NextResponse.json({
      message: 'Year-end processing completed successfully',
      processed: result.processed,
      errors: result.errors
    });

  } catch (error) {
    console.error('Error processing year-end:', error);
    return NextResponse.json(
      { error: 'Failed to process year-end carry forward' },
      { status: 500 }
    );
  }
}