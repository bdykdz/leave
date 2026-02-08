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

    const trends = [];
    const today = new Date();

    // Get data for the last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      // Get WFH requests for this month
      const totalWFH = await prisma.workFromHomeRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart }
        }
      });

      trends.push({
        month: format(monthDate, 'MMM'),
        regular: totalWFH,
        emergency: 0,
        total: totalWFH
      });
    }

    return NextResponse.json(trends);
  } catch (error) {
    console.error('Error fetching remote trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch remote work trends' },
      { status: 500 }
    );
  }
}
