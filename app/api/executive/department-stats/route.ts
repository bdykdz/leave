import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

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
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Get all departments
    const departments = await prisma.user.groupBy({
      by: ['department'],
      where: { isActive: true },
      _count: { id: true }
    });

    // Get leave stats by department
    const departmentStats = await Promise.all(
      departments.map(async (dept) => {
        // Get employees in this department
        const deptUsers = await prisma.user.findMany({
          where: {
            department: dept.department,
            isActive: true
          },
          select: { id: true }
        });

        const userIds = deptUsers.map(u => u.id);

        // Get leave requests for this department this month
        const leaveRequests = await prisma.leaveRequest.findMany({
          where: {
            userId: { in: userIds },
            status: 'APPROVED',
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart }
          },
          select: { totalDays: true }
        });

        const totalLeaveDays = leaveRequests.reduce(
          (sum, req) => sum + req.totalDays, 
          0
        );

        // Get WFH requests
        const wfhRequests = await prisma.workFromHomeRequest.count({
          where: {
            userId: { in: userIds },
            status: 'APPROVED',
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart }
          }
        });

        return {
          department: dept.department,
          employeeCount: dept._count.id,
          totalLeaveDays,
          averageLeavePerEmployee: dept._count.id > 0 
            ? (totalLeaveDays / dept._count.id).toFixed(1) 
            : 0,
          wfhRequests
        };
      })
    );

    return NextResponse.json(departmentStats);
  } catch (error) {
    console.error('Error fetching department stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch department statistics' },
      { status: 500 }
    );
  }
}
