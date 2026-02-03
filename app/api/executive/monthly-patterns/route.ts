import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'EXECUTIVE' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const patterns = [];
    const today = new Date();

    // Get data for the last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      // Get leave requests for this month
      const leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart }
        },
        select: { totalDays: true }
      });

      // Get WFH requests for this month
      const wfhCount = await prisma.workFromHomeRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart }
        }
      });

      const totalLeaveDays = leaveRequests.reduce(
        (sum, req) => sum + req.totalDays, 
        0
      );

      patterns.push({
        month: format(monthDate, 'MMM'),
        leave: totalLeaveDays,
        remote: wfhCount
      });
    }

    return NextResponse.json(patterns);
  } catch (error) {
    console.error('Error fetching monthly patterns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly patterns' },
      { status: 500 }
    );
  }
}
