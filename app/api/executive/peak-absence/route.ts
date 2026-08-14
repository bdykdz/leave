import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { NO_SUBSTITUTE_USER } from '@/lib/no-substitute-user';
import { addMonths, format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'EXECUTIVE' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const today = new Date();
    const threeMonthsOut = addMonths(today, 3);

    // Count total active employees (exclude virtual substitute user)
    const totalEmployees = await prisma.user.count({
      where: { isActive: true, employeeId: { not: NO_SUBSTITUTE_USER.EMPLOYEE_ID } }
    });

    if (totalEmployees === 0) {
      return NextResponse.json([]);
    }

    // Fetch approved/pending leave requests in the next 3 months
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: threeMonthsOut },
        endDate: { gte: startOfDay(today) }
      },
      select: {
        startDate: true,
        endDate: true,
        userId: true,
        user: { select: { department: true } }
      }
    });

    if (leaveRequests.length === 0) {
      return NextResponse.json([]);
    }

    // Count unique employees absent per day
    const dayAbsenceMap = new Map<string, Set<string>>();
    const dayDeptMap = new Map<string, Set<string>>();

    for (const req of leaveRequests) {
      const start = req.startDate < today ? today : req.startDate;
      const end = req.endDate > threeMonthsOut ? threeMonthsOut : req.endDate;

      const days = eachDayOfInterval({
        start: startOfDay(start),
        end: endOfDay(end)
      });

      for (const day of days) {
        // Skip weekends
        const dow = day.getDay();
        if (dow === 0 || dow === 6) continue;

        const key = format(day, 'yyyy-MM-dd');
        if (!dayAbsenceMap.has(key)) {
          dayAbsenceMap.set(key, new Set());
          dayDeptMap.set(key, new Set());
        }
        dayAbsenceMap.get(key)!.add(req.userId);
        if (req.user.department) {
          dayDeptMap.get(key)!.add(req.user.department);
        }
      }
    }

    // Find clusters of high-absence days (>10% of workforce)
    const threshold = Math.max(2, Math.ceil(totalEmployees * 0.10));
    const highDays = Array.from(dayAbsenceMap.entries())
      .filter(([, users]) => users.size >= threshold)
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (highDays.length === 0) {
      return NextResponse.json([]);
    }

    // Group consecutive high-absence days into periods
    const periods: {
      startDate: string;
      endDate: string;
      maxAbsent: number;
      departments: Set<string>;
    }[] = [];

    let currentPeriod = {
      startDate: highDays[0][0],
      endDate: highDays[0][0],
      maxAbsent: highDays[0][1].size,
      departments: new Set(dayDeptMap.get(highDays[0][0]) || [])
    };

    for (let i = 1; i < highDays.length; i++) {
      const [dateStr, users] = highDays[i];
      const prevDate = new Date(highDays[i - 1][0]);
      const currDate = new Date(dateStr);
      const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDiff <= 3) { // Allow up to 3-day gaps (weekends)
        currentPeriod.endDate = dateStr;
        currentPeriod.maxAbsent = Math.max(currentPeriod.maxAbsent, users.size);
        const depts = dayDeptMap.get(dateStr);
        if (depts) {
          for (const d of depts) currentPeriod.departments.add(d);
        }
      } else {
        periods.push(currentPeriod);
        currentPeriod = {
          startDate: dateStr,
          endDate: dateStr,
          maxAbsent: users.size,
          departments: new Set(dayDeptMap.get(dateStr) || [])
        };
      }
    }
    periods.push(currentPeriod);

    // Sort by maxAbsent descending, take top 5
    const topPeriods = periods
      .sort((a, b) => b.maxAbsent - a.maxAbsent)
      .slice(0, 5)
      .map(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        const percentage = Math.round((p.maxAbsent / totalEmployees) * 100);
        const deptArray = Array.from(p.departments).sort();

        return {
          period: start.getTime() === end.getTime()
            ? format(start, 'MMM d')
            : `${format(start, 'MMM d')}-${format(end, start.getMonth() === end.getMonth() ? 'd' : 'MMM d')}`,
          percentageOfWorkforce: percentage,
          expectedAbsent: p.maxAbsent,
          departments: deptArray,
          businessImpact: percentage > 25
            ? 'High absence may affect project deadlines'
            : percentage > 15
              ? 'Moderate absence - plan resource coverage'
              : 'Manageable absence levels'
        };
      });

    return NextResponse.json(topPeriods);
  } catch (error) {
    console.error('Error fetching peak absence periods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch peak absence data' },
      { status: 500 }
    );
  }
}
