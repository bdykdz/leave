import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, isWeekend, eachDayOfInterval } from 'date-fns';

// GET: Fetch manager's own WFH statistics for the current month
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Calculate working days in the month (excluding weekends)
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const workingDaysInMonth = allDaysInMonth.filter(day => !isWeekend(day)).length;

    // Fetch manager's approved WFH requests for current month
    const wfhRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        leaveType: {
          code: 'WFH'
        },
        status: 'APPROVED',
        startDate: {
          lte: monthEnd
        },
        endDate: {
          gte: monthStart
        }
      },
      include: {
        leaveType: true
      }
    });

    // Calculate total WFH days used in the current month
    let daysUsed = 0;
    
    for (const request of wfhRequests) {
      const requestStart = request.startDate > monthStart ? request.startDate : monthStart;
      const requestEnd = request.endDate < monthEnd ? request.endDate : monthEnd;
      
      const daysInMonth = eachDayOfInterval({ 
        start: requestStart, 
        end: requestEnd 
      });
      
      // Count only working days
      const workingDaysUsed = daysInMonth.filter(day => !isWeekend(day)).length;
      daysUsed += workingDaysUsed;
    }

    // Calculate percentage
    const percentage = workingDaysInMonth > 0 
      ? Math.round((daysUsed / workingDaysInMonth) * 100) 
      : 0;

    return NextResponse.json({
      daysUsed,
      workingDaysInMonth,
      percentage,
      month: now.toISOString()
    });
  } catch (error) {
    console.error('Error fetching manager WFH stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WFH statistics' },
      { status: 500 }
    );
  }
}