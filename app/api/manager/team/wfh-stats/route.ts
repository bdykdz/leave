import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, isWeekend, eachDayOfInterval } from 'date-fns';

// GET: Fetch team WFH statistics for manager's direct reports
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all direct reports
    const directReports = await prisma.user.findMany({
      where: {
        managerId: session.user.id
      },
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    });

    if (directReports.length === 0) {
      return NextResponse.json({
        averageWfhPercentage: 0,
        totalWfhDays: 0,
        totalWorkingDays: 0,
        teamSize: 0,
        monthlyBreakdown: []
      });
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Calculate working days in the month
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const workingDaysInMonth = allDaysInMonth.filter(day => !isWeekend(day)).length;

    // Fetch WFH requests for all team members
    const teamWfhRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: {
          in: directReports.map(dr => dr.id)
        },
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        leaveType: true
      }
    });

    // Calculate WFH days per team member
    const memberWfhDays = new Map<string, number>();
    
    for (const request of teamWfhRequests) {
      const requestStart = request.startDate > monthStart ? request.startDate : monthStart;
      const requestEnd = request.endDate < monthEnd ? request.endDate : monthEnd;
      
      const daysInMonth = eachDayOfInterval({ 
        start: requestStart, 
        end: requestEnd 
      });
      
      // Count only working days
      const workingDaysUsed = daysInMonth.filter(day => !isWeekend(day)).length;
      
      const currentDays = memberWfhDays.get(request.userId) || 0;
      memberWfhDays.set(request.userId, currentDays + workingDaysUsed);
    }

    // Calculate statistics
    const totalWfhDays = Array.from(memberWfhDays.values()).reduce((sum, days) => sum + days, 0);
    const totalWorkingDays = workingDaysInMonth * directReports.length;
    const averageWfhPercentage = totalWorkingDays > 0 
      ? Math.round((totalWfhDays / totalWorkingDays) * 100) 
      : 0;

    // Create per-member breakdown
    const monthlyBreakdown = directReports.map(member => {
      const wfhDays = memberWfhDays.get(member.id) || 0;
      const percentage = workingDaysInMonth > 0 
        ? Math.round((wfhDays / workingDaysInMonth) * 100) 
        : 0;
      
      return {
        userId: member.id,
        name: `${member.firstName} ${member.lastName}`,
        wfhDays,
        workingDaysInMonth,
        percentage
      };
    }).sort((a, b) => b.percentage - a.percentage); // Sort by percentage descending

    return NextResponse.json({
      averageWfhPercentage,
      totalWfhDays,
      totalWorkingDays,
      teamSize: directReports.length,
      workingDaysInMonth,
      month: now.toISOString(),
      monthlyBreakdown
    });
  } catch (error) {
    console.error('Error fetching team WFH stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team WFH statistics' },
      { status: 500 }
    );
  }
}