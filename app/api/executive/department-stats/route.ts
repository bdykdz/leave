import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

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
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Fetch all active users with their department in a single query
    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, department: true }
    });

    // Group users by department
    const deptUserMap = new Map<string, string[]>();
    for (const user of allUsers) {
      const dept = user.department || 'Unassigned';
      if (!deptUserMap.has(dept)) {
        deptUserMap.set(dept, []);
      }
      deptUserMap.get(dept)!.push(user.id);
    }

    const allUserIds = allUsers.map(u => u.id);

    // Fetch all approved leave requests overlapping today (single query)
    const onLeaveToday = await prisma.leaveRequest.findMany({
      where: {
        userId: { in: allUserIds },
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart }
      },
      select: { userId: true }
    });

    // Fetch all approved WFH requests overlapping today (single query)
    const remoteToday = await prisma.workFromHomeRequest.findMany({
      where: {
        userId: { in: allUserIds },
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart }
      },
      select: { userId: true }
    });

    // Fetch all pending leave requests (single query)
    const pendingLeave = await prisma.leaveRequest.findMany({
      where: {
        userId: { in: allUserIds },
        status: 'PENDING'
      },
      select: { userId: true }
    });

    // Fetch approved leave requests for the month (for totalLeaveDays)
    const monthLeave = await prisma.leaveRequest.findMany({
      where: {
        userId: { in: allUserIds },
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart }
      },
      select: { userId: true, totalDays: true }
    });

    // Fetch WFH requests for the month
    const monthWfh = await prisma.workFromHomeRequest.findMany({
      where: {
        userId: { in: allUserIds },
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart }
      },
      select: { userId: true }
    });

    // Build sets for quick lookup by userId
    const onLeaveTodayByUser = new Set(onLeaveToday.map(r => r.userId));
    const remoteTodayByUser = new Set(remoteToday.map(r => r.userId));
    const pendingByUser = new Map<string, number>();
    for (const r of pendingLeave) {
      pendingByUser.set(r.userId, (pendingByUser.get(r.userId) || 0) + 1);
    }
    const monthLeaveByUser = new Map<string, number>();
    for (const r of monthLeave) {
      monthLeaveByUser.set(r.userId, (monthLeaveByUser.get(r.userId) || 0) + r.totalDays);
    }
    const monthWfhByUser = new Map<string, number>();
    for (const r of monthWfh) {
      monthWfhByUser.set(r.userId, (monthWfhByUser.get(r.userId) || 0) + 1);
    }

    // Build department stats
    const departmentStats = Array.from(deptUserMap.entries()).map(([department, userIds]) => {
      const employees = userIds.length;
      const onLeaveTodayCount = userIds.filter(id => onLeaveTodayByUser.has(id)).length;
      const remoteTodayCount = userIds.filter(id => remoteTodayByUser.has(id)).length;
      const pendingRequestsCount = userIds.reduce((sum, id) => sum + (pendingByUser.get(id) || 0), 0);
      const totalLeaveDays = userIds.reduce((sum, id) => sum + (monthLeaveByUser.get(id) || 0), 0);
      const wfhRequests = userIds.reduce((sum, id) => sum + (monthWfhByUser.get(id) || 0), 0);

      return {
        department,
        employees,
        onLeaveToday: onLeaveTodayCount,
        remoteToday: remoteTodayCount,
        pendingRequests: pendingRequestsCount,
        totalLeaveDays,
        averageLeavePerEmployee: employees > 0
          ? Number((totalLeaveDays / employees).toFixed(1))
          : 0,
        wfhRequests
      };
    });

    return NextResponse.json(departmentStats);
  } catch (error) {
    console.error('Error fetching department stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch department statistics' },
      { status: 500 }
    );
  }
}
