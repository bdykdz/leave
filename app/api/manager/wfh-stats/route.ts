import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';

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
    const workingDaysInMonth = allDaysInMonth.filter(day => {
      const dayOfWeek = getDay(day);
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    }).length;

    // Fetch manager's approved WFH requests for current month
    const wfhRequests = await prisma.workFromHomeRequest.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart }
      },
      select: {
        startDate: true,
        endDate: true,
        selectedDates: true
      }
    });

    // Calculate total WFH days used in the current month
    let daysUsed = 0;

    for (const request of wfhRequests) {
      const selectedDates = request.selectedDates as string[] | null;

      if (selectedDates && selectedDates.length > 0) {
        // Count only selected dates that fall within the month and are business days
        const daysInMonth = selectedDates.filter(dateStr => {
          const date = new Date(dateStr);
          const dayOfWeek = getDay(date);
          return date >= monthStart && date <= monthEnd && dayOfWeek !== 0 && dayOfWeek !== 6;
        });
        daysUsed += daysInMonth.length;
      } else {
        // Fallback: count all business days in startDate-endDate range
        const requestStart = request.startDate > monthStart ? request.startDate : monthStart;
        const requestEnd = request.endDate < monthEnd ? request.endDate : monthEnd;

        if (requestStart <= requestEnd) {
          const days = eachDayOfInterval({ start: requestStart, end: requestEnd });
          const businessDays = days.filter(day => {
            const dayOfWeek = getDay(day);
            return dayOfWeek !== 0 && dayOfWeek !== 6;
          });
          daysUsed += businessDays.length;
        }
      }
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