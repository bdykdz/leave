import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only executives can access company-wide metrics
    if (session.user.role !== 'EXECUTIVE' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Get total employees
    const totalEmployees = await prisma.user.count({
      where: { isActive: true }
    });

    // Get employees on leave today
    const onLeaveToday = await prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart }
      }
    });

    // Get employees working remote today
    const workingRemoteToday = await prisma.workFromHomeRequest.count({
      where: {
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart }
      }
    });

    // Calculate in office today
    const inOfficeToday = Math.max(0, totalEmployees - onLeaveToday - workingRemoteToday);

    // Get pending approvals that have executive approvers
    const pendingApprovals = await prisma.leaveRequest.count({
      where: {
        status: 'PENDING',
        approvals: {
          some: {
            approver: {
              role: 'EXECUTIVE'
            },
            status: 'PENDING'
          }
        }
      }
    });

    // Get total leave days this month
    const leaveRequestsThisMonth = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart }
      },
      select: {
        totalDays: true
      }
    });

    const totalLeaveDaysThisMonth = leaveRequestsThisMonth.reduce(
      (sum, req) => sum + req.totalDays, 
      0
    );

    // Get total remote days this month
    const remoteRequestsThisMonth = await prisma.workFromHomeRequest.findMany({
      where: {
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

    // Calculate total remote days
    let totalRemoteDaysThisMonth = 0;
    remoteRequestsThisMonth.forEach(req => {
      if (req.selectedDates && Array.isArray(req.selectedDates)) {
        totalRemoteDaysThisMonth += req.selectedDates.length;
      } else {
        // Calculate days between start and end
        const start = new Date(req.startDate);
        const end = new Date(req.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        totalRemoteDaysThisMonth += diffDays;
      }
    });

    // Calculate average leave days per employee
    const averageLeaveDaysPerEmployee = totalEmployees > 0 
      ? (totalLeaveDaysThisMonth / totalEmployees).toFixed(1) 
      : 0;

    // Calculate leave utilization rate
    // Assuming 21 working days per month and each employee has leave entitlement
    const totalAvailableLeaveDays = totalEmployees * 21; // Working days in month
    const leaveUtilizationRate = totalAvailableLeaveDays > 0
      ? ((totalLeaveDaysThisMonth / totalAvailableLeaveDays) * 100).toFixed(1)
      : 0;

    return NextResponse.json({
      totalEmployees,
      onLeaveToday,
      workingRemoteToday,
      inOfficeToday,
      pendingApprovals,
      totalLeaveDaysThisMonth,
      totalRemoteDaysThisMonth,
      averageLeaveDaysPerEmployee: parseFloat(averageLeaveDaysPerEmployee as string),
      leaveUtilizationRate: parseFloat(leaveUtilizationRate as string)
    });
  } catch (error) {
    console.error('Error fetching company metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company metrics' },
      { status: 500 }
    );
  }
}
