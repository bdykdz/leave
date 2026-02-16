import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'EXECUTIVE' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const currentYear = new Date().getFullYear();

    // Fetch all leave balances for the current year with user department info
    const balances = await prisma.leaveBalance.findMany({
      where: {
        year: currentYear,
        user: { isActive: true }
      },
      select: {
        used: true,
        entitled: true,
        carriedForward: true,
        user: {
          select: { department: true }
        }
      }
    });

    // Aggregate by department
    const deptMap = new Map<string, { used: number; total: number }>();
    for (const bal of balances) {
      const dept = bal.user.department || 'Unassigned';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { used: 0, total: 0 });
      }
      const entry = deptMap.get(dept)!;
      entry.used += bal.used;
      entry.total += bal.entitled + bal.carriedForward;
    }

    const utilization = Array.from(deptMap.entries()).map(([department, data]) => ({
      department,
      used: data.used,
      remaining: Math.max(0, data.total - data.used),
      utilizationRate: data.total > 0
        ? Number(((data.used / data.total) * 100).toFixed(1))
        : 0
    }));

    // Sort by utilization rate descending
    utilization.sort((a, b) => b.utilizationRate - a.utilizationRate);

    return NextResponse.json(utilization);
  } catch (error) {
    console.error('Error fetching leave utilization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave utilization data' },
      { status: 500 }
    );
  }
}
