import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfWeek, endOfWeek } from 'date-fns';

// Called by cron every Monday at ~08:00 Bucharest time (06:00 UTC)
// In winter (EET, UTC+2): runs at 08:00 Bucharest. In summer (EEST, UTC+3): runs at 09:00 Bucharest.
// Cancels any PENDING WFH requests that have dates in the current week
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current week boundaries (Monday to Sunday)
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // Find all PENDING WFH requests with dates in this week
    const pendingRequests = await prisma.workFromHomeRequest.findMany({
      where: {
        status: 'PENDING',
        startDate: {
          lte: weekEnd
        },
        endDate: {
          gte: weekStart
        }
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    let cancelledCount = 0;

    for (const req of pendingRequests) {
      await prisma.workFromHomeRequest.update({
        where: { id: req.id },
        data: { status: 'CANCELLED' }
      });

      // Cancel any pending approvals
      await prisma.wFHApproval.updateMany({
        where: {
          wfhRequestId: req.id,
          status: 'PENDING'
        },
        data: { status: 'CANCELLED' }
      });

      // Notify the user
      await prisma.notification.create({
        data: {
          userId: req.userId,
          type: 'WFH_CANCELLED',
          title: 'WFH Request Auto-Cancelled',
          message: `Your WFH request for ${req.startDate.toISOString().split('T')[0]} to ${req.endDate.toISOString().split('T')[0]} was automatically cancelled because it was not approved before the start of the week.`,
          link: '/employee/remote'
        }
      });

      cancelledCount++;
      console.log(`Auto-cancelled WFH request for ${req.user.firstName} ${req.user.lastName} (${req.startDate.toISOString().split('T')[0]} - ${req.endDate.toISOString().split('T')[0]})`);
    }

    return NextResponse.json({
      success: true,
      message: `Auto-cancelled ${cancelledCount} pending WFH requests`,
      cancelledCount,
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error('WFH auto-cancel error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-cancel WFH requests' },
      { status: 500 }
    );
  }
}
