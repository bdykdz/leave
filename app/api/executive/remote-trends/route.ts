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

    const today = new Date();

    // Fetch all active users with departments
    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, department: true }
    });

    // Build userId -> department map
    const userDeptMap = new Map<string, string>();
    const departmentSet = new Set<string>();
    for (const user of allUsers) {
      const dept = user.department || 'Unassigned';
      userDeptMap.set(user.id, dept);
      departmentSet.add(dept);
    }
    const departments = Array.from(departmentSet).sort();

    // Get the 6-month date range
    const sixMonthsAgo = startOfMonth(subMonths(today, 5));
    const currentMonthEnd = endOfMonth(today);

    // Fetch all approved WFH requests in the 6-month window (single query)
    const wfhRequests = await prisma.workFromHomeRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: currentMonthEnd },
        endDate: { gte: sixMonthsAgo }
      },
      select: { userId: true, startDate: true, endDate: true }
    });

    // Build trends per month per department
    const trends = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const entry: Record<string, any> = {
        month: format(monthDate, 'MMM'),
      };

      // Initialize all departments to 0
      for (const dept of departments) {
        entry[dept] = 0;
      }

      // Count WFH requests per department for this month
      for (const req of wfhRequests) {
        if (req.startDate <= monthEnd && req.endDate >= monthStart) {
          const dept = userDeptMap.get(req.userId) || 'Unassigned';
          entry[dept] = (entry[dept] || 0) + 1;
        }
      }

      trends.push(entry);
    }

    return NextResponse.json({ trends, departments });
  } catch (error) {
    console.error('Error fetching remote trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch remote work trends' },
      { status: 500 }
    );
  }
}
