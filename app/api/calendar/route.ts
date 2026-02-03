import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { log } from '@/lib/logger';
import { asyncHandler } from '@/lib/async-handler';

// GET /api/calendar - Get team calendar data
export const GET = asyncHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const month = searchParams.get('month') || new Date().toISOString();
  const teamId = searchParams.get('teamId');
  
  const targetDate = parseISO(month);
  const startDate = startOfMonth(targetDate);
  const endDate = endOfMonth(targetDate);

  log.debug('Fetching calendar data', { 
    userId: session.user.id,
    startDate,
    endDate,
    teamId 
  });

  // Get user's team members (direct reports for managers, department members for others)
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subordinates: true,
    },
  });

  if (!currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Everyone can see everyone in the company calendar
  // This promotes transparency across all levels and teams
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const userIds = allUsers.map(u => u.id);

  // Fetch leave requests
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: userIds },
      status: { in: ['PENDING', 'APPROVED'] },
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          profileImage: true,
        },
      },
      leaveType: true,
      substitute: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Fetch WFH requests
  const wfhRequests = await prisma.workFromHomeRequest.findMany({
    where: {
      userId: { in: userIds },
      status: { in: ['PENDING', 'APPROVED'] },
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          profileImage: true,
        },
      },
    },
  });

  // Fetch holidays for the month
  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
      isActive: true,
    },
    select: {
      id: true,
      nameEn: true,
      nameRo: true,
      date: true,
      isBlocked: true,
    },
  });

  // Transform data for calendar display
  const calendarEvents = [
    ...leaveRequests.map(leave => ({
      id: leave.id,
      type: 'leave' as const,
      userId: leave.userId,
      userName: `${leave.user.firstName} ${leave.user.lastName}`,
      userAvatar: leave.user.profileImage,
      userInitials: `${leave.user.firstName[0]}${leave.user.lastName[0]}`,
      department: leave.user.department,
      startDate: leave.startDate,
      endDate: leave.endDate,
      leaveType: leave.leaveType.name,
      status: leave.status.toLowerCase(),
      reason: leave.reason,
      substitute: leave.substitute ? 
        `${leave.substitute.firstName} ${leave.substitute.lastName}` : null,
      selectedDates: leave.selectedDates,
    })),
    ...wfhRequests.map(wfh => ({
      id: wfh.id,
      type: 'wfh' as const,
      userId: wfh.userId,
      userName: `${wfh.user.firstName} ${wfh.user.lastName}`,
      userAvatar: wfh.user.profileImage,
      userInitials: `${wfh.user.firstName[0]}${wfh.user.lastName[0]}`,
      department: wfh.user.department,
      startDate: wfh.startDate,
      endDate: wfh.endDate,
      leaveType: 'Work From Home',
      status: wfh.status.toLowerCase(),
      location: wfh.location,
      selectedDates: wfh.selectedDates as Date[] | null,
    })),
  ];

  // Get team summary
  const teamSummary = {
    totalMembers: userIds.length,
    onLeave: leaveRequests.filter(l => l.status === 'APPROVED').length,
    workingFromHome: wfhRequests.filter(w => w.status === 'APPROVED').length,
    pending: [...leaveRequests, ...wfhRequests].filter(
      r => r.status === 'PENDING'
    ).length,
  };

  log.info('Calendar data fetched', { 
    events: calendarEvents.length,
    holidays: holidays.length 
  });

  return NextResponse.json({ 
    events: calendarEvents,
    holidays,
    summary: teamSummary,
  });
});