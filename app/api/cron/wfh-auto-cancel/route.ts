import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addDays, startOfDay, endOfWeek } from 'date-fns';
import { verifyCronAuth } from '@/lib/security';

// Called by cron every Friday at 23:59 UTC (Saturday 01:59 Bucharest time)
// Cancels any PENDING WFH requests for the upcoming week (next Mon-Sun)
// Also catches any stale PENDING requests from past dates
export async function GET(request: NextRequest) {
  try {
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const today = startOfDay(now);

    // Cancel all PENDING WFH requests whose startDate is <= next Sunday
    // This covers: any past-dated stale requests + the upcoming week
    const nextSunday = endOfWeek(addDays(today, 2), { weekStartsOn: 1 });

    const pendingRequests = await prisma.workFromHomeRequest.findMany({
      where: {
        status: 'PENDING',
        startDate: {
          lte: nextSunday
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

      // Reject any pending approvals
      await prisma.wFHApproval.updateMany({
        where: {
          wfhRequestId: req.id,
          status: 'PENDING'
        },
        data: { status: 'REJECTED', comments: 'Auto-cancelled: not approved by end of Friday' }
      });

      // Notify the user
      await prisma.notification.create({
        data: {
          userId: req.userId,
          type: 'WFH_CANCELLED',
          title: 'WFH Request Auto-Cancelled',
          message: `Your WFH request for ${req.startDate.toISOString().split('T')[0]} to ${req.endDate.toISOString().split('T')[0]} was automatically cancelled because it was not approved by end of Friday.`,
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
