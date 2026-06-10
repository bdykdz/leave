import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { DelegationService } from '@/lib/services/delegation-service';
import { z } from 'zod';
import { format } from 'date-fns';
import { log } from '@/lib/logger';
import { asyncHandler, safeAsync } from '@/lib/async-handler';
import { emailService } from '@/lib/email-service';

// Validation schema for work trip request
const createWorkTripRequestSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  selectedDates: z.array(z.string()).optional(),
  destination: z.string().min(1, 'Destination is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  signature: z.string().optional(),
});

// Format work trip dates for display
function formatWorkTripDates(startDate: Date, endDate: Date, selectedDates?: string[] | null): string {
  if (selectedDates && selectedDates.length > 0) {
    const dates = selectedDates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
    const groups: string[] = [];
    let currentGroup = [dates[0]];

    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentGroup.push(currDate);
      } else {
        groups.push(formatDateGroup(currentGroup));
        currentGroup = [currDate];
      }
    }
    groups.push(formatDateGroup(currentGroup));

    return groups.join(', ');
  } else {
    const start = format(startDate, 'dd MMMM yyyy');
    const end = format(endDate, 'dd MMMM yyyy');

    if (startDate.toDateString() === endDate.toDateString()) {
      return start;
    }

    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.getDate()}-${endDate.getDate()} ${format(startDate, 'MMMM yyyy')}`;
    }

    return `${start} - ${end}`;
  }
}

function formatDateGroup(dates: Date[]): string {
  if (dates.length === 1) {
    return format(dates[0], 'dd MMMM yyyy');
  } else {
    const first = dates[0].getDate();
    const last = dates[dates.length - 1].getDate();
    const month = format(dates[0], 'MMMM yyyy');
    return `${first}-${last} ${month}`;
  }
}

// GET /api/work-trip-requests - Get user's work trip requests
export const GET = asyncHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const year = searchParams.get('year') || new Date().getFullYear().toString();

  const where: any = {
    userId: session.user.id,
  };

  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (year !== 'all') {
    where.startDate = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }

  log.debug('Fetching work trip requests', {
    userId: session.user.id,
    where
  });

  const workTripRequests = await prisma.workTripRequest.findMany({
    where,
    include: {
      user: true,
      approvals: {
        include: {
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      },
      document: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  log.info('Work trip requests fetched', { count: workTripRequests.length });

  return NextResponse.json({ workTripRequests }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
});

// POST /api/work-trip-requests - Create a new work trip request
export const POST = asyncHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Validate request body
  const validatedData = createWorkTripRequestSchema.parse(body);

  // Extract signature separately
  const signature = body.signature || null;

  // Get user details including manager
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      manager: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Calculate dates
  const startDate = new Date(validatedData.startDate);
  const endDate = new Date(validatedData.endDate);
  const totalDays = validatedData.selectedDates?.length ||
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const toDateStr = (d: Date) => format(d, 'yyyy-MM-dd');
  const requestedDays = validatedData.selectedDates || [];

  // Check for overlapping work trip requests
  const overlappingWorkTrip = await prisma.workTripRequest.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ['APPROVED', 'PENDING'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    select: { startDate: true, endDate: true, selectedDates: true }
  });

  if (overlappingWorkTrip) {
    const existingDates = new Set<string>();
    const wtSelectedDates = overlappingWorkTrip.selectedDates as string[] | null;
    if (wtSelectedDates && wtSelectedDates.length > 0) {
      for (const d of wtSelectedDates) {
        existingDates.add(String(d).split('T')[0]);
      }
    } else {
      const cursor = new Date(overlappingWorkTrip.startDate);
      while (cursor <= overlappingWorkTrip.endDate) {
        existingDates.add(toDateStr(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const conflicting: string[] = [];
    const available: string[] = [];
    for (const dayStr of requestedDays) {
      const normalized = dayStr.split('T')[0];
      if (existingDates.has(normalized)) {
        conflicting.push(format(new Date(dayStr), 'MMM d'));
      } else {
        available.push(format(new Date(dayStr), 'MMM d'));
      }
    }

    if (conflicting.length > 0) {
      const availableSuggestion = available.length > 0
        ? `You can still request a work trip for: ${available.join(', ')}.`
        : 'All selected days overlap with your existing request.';

      return NextResponse.json(
        {
          error: 'Date conflict',
          message: `You already have a work trip request from ${format(overlappingWorkTrip.startDate, 'MMM d, yyyy')} to ${format(overlappingWorkTrip.endDate, 'MMM d, yyyy')}. Conflicting days: ${conflicting.join(', ')}. ${availableSuggestion}`,
          conflictType: 'WORK_TRIP_CONFLICT',
        },
        { status: 400 }
      );
    }
  }

  // Check for overlapping WFH requests
  const overlappingWFH = await prisma.workFromHomeRequest.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ['APPROVED', 'PENDING'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    select: { startDate: true, endDate: true, selectedDates: true }
  });

  if (overlappingWFH) {
    const existingWfhDates = new Set<string>();
    const wfhSelectedDates = overlappingWFH.selectedDates as string[] | null;
    if (wfhSelectedDates && wfhSelectedDates.length > 0) {
      for (const d of wfhSelectedDates) {
        existingWfhDates.add(String(d).split('T')[0]);
      }
    } else {
      const cursor = new Date(overlappingWFH.startDate);
      while (cursor <= overlappingWFH.endDate) {
        existingWfhDates.add(toDateStr(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const conflicting: string[] = [];
    for (const dayStr of requestedDays) {
      const normalized = dayStr.split('T')[0];
      if (existingWfhDates.has(normalized)) {
        conflicting.push(format(new Date(dayStr), 'MMM d'));
      }
    }

    if (conflicting.length > 0) {
      return NextResponse.json(
        {
          error: 'Date conflict',
          message: `You have a remote work request overlapping with these dates. Conflicting days: ${conflicting.join(', ')}.`,
          conflictType: 'WFH_CONFLICT',
        },
        { status: 400 }
      );
    }
  }

  // Check for overlapping leave requests
  const overlappingLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ['APPROVED', 'PENDING'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    include: { leaveType: { select: { name: true } } }
  });

  if (overlappingLeave) {
    const leaveDates = new Set<string>();
    if (overlappingLeave.selectedDates && overlappingLeave.selectedDates.length > 0) {
      for (const d of overlappingLeave.selectedDates) {
        leaveDates.add(d instanceof Date ? toDateStr(d) : String(d).split('T')[0]);
      }
    } else {
      const cursor = new Date(overlappingLeave.startDate);
      while (cursor <= overlappingLeave.endDate) {
        leaveDates.add(toDateStr(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const leaveTypeName = overlappingLeave.leaveType?.name || 'leave';
    const conflicting: string[] = [];
    for (const dayStr of requestedDays) {
      const normalized = dayStr.split('T')[0];
      if (leaveDates.has(normalized)) {
        conflicting.push(format(new Date(dayStr), 'MMM d'));
      }
    }

    if (conflicting.length > 0) {
      return NextResponse.json(
        {
          error: 'Date conflict',
          message: `You have an approved ${leaveTypeName} overlapping with these dates. Conflicting days: ${conflicting.join(', ')}.`,
          conflictType: 'LEAVE_CONFLICT',
        },
        { status: 400 }
      );
    }
  }

  // Generate request number
  const currentYear = new Date().getFullYear();
  const requestCount = await prisma.workTripRequest.count({
    where: {
      createdAt: {
        gte: new Date(`${currentYear}-01-01`),
      },
    },
  });
  const requestNumber = `WT-${currentYear}-${String(requestCount + 1).padStart(4, '0')}`;

  // Create work trip request with approval for manager
  const workTripRequest = await prisma.workTripRequest.create({
    data: {
      requestNumber,
      userId: session.user.id,
      startDate,
      endDate,
      selectedDates: validatedData.selectedDates || Prisma.DbNull,
      totalDays,
      destination: validatedData.destination,
      purpose: validatedData.purpose,
      status: 'PENDING',
      approvals: user.managerId ? {
        create: {
          approverId: user.managerId,
          status: 'PENDING',
        },
      } : undefined,
    },
    include: {
      user: true,
      approvals: {
        include: {
          approver: true,
        },
      },
    },
  });

  // Create notification for manager
  if (user.managerId) {
    const managerUser = await prisma.user.findUnique({
      where: { id: user.managerId },
      select: { role: true, department: true }
    });

    let notificationLink = `/manager?workTrip=${workTripRequest.id}`;
    if (managerUser) {
      if (managerUser.role === 'HR' ||
          (managerUser.role === 'EMPLOYEE' && (managerUser.department?.toLowerCase() === 'hr' || managerUser.department?.toLowerCase() === 'human resources'))) {
        notificationLink = `/hr?workTrip=${workTripRequest.id}`;
      } else if (managerUser.role === 'EXECUTIVE') {
        notificationLink = `/executive?workTrip=${workTripRequest.id}`;
      }
    }

    await prisma.notification.create({
      data: {
        userId: user.managerId,
        type: 'APPROVAL_REQUIRED',
        title: 'Work Trip Request Approval Required',
        message: `${user.firstName || ''} ${user.lastName || ''} has requested a ${totalDays}-day work trip to ${validatedData.destination}`.trim(),
        link: notificationLink,
      },
    });

    // Additive delegation: also notify anyone currently covering the manager's duties
    const managerDelegateIds = await DelegationService.getActiveDelegateIdsFor(user.managerId);
    for (const delegateId of managerDelegateIds) {
      await safeAsync(async () => {
        await prisma.notification.create({
          data: {
            userId: delegateId,
            type: 'APPROVAL_REQUIRED',
            title: 'Work Trip Request Approval Required (delegated)',
            message: `${user.firstName || ''} ${user.lastName || ''} has requested a ${totalDays}-day work trip to ${validatedData.destination} — you are covering approvals.`.trim(),
            link: notificationLink,
          },
        });
      }, undefined, `Failed to notify delegate ${delegateId}`);
    }
  }

  // Send email notification to manager
  if (user.manager?.email) {
    await safeAsync(async () => {
      log.info('Sending work trip email notification', {
        requestId: workTripRequest.id,
        to: user.manager!.email,
      });

      const formattedDates = formatWorkTripDates(startDate, endDate, validatedData.selectedDates);

      await emailService.sendWorkTripRequestNotification(user.manager!.email, {
        employeeName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        startDate: formattedDates,
        endDate: '',
        days: totalDays,
        destination: validatedData.destination,
        purpose: validatedData.purpose,
        managerName: `${user.manager!.firstName || ''} ${user.manager!.lastName || ''}`.trim(),
        requestId: workTripRequest.id,
      });

      log.info('Work trip email sent', { to: user.manager!.email });
    }, undefined, 'Failed to send work trip email notification');
  }

  // Generate document if signature provided
  if (signature) {
    await safeAsync(async () => {
      const document = await prisma.workTripDocument.create({
        data: {
          workTripRequestId: workTripRequest.id,
          status: 'PENDING_SIGNATURES',
        },
      });

      await prisma.workTripSignature.create({
        data: {
          documentId: document.id,
          signerId: session.user.id,
          signerRole: 'employee',
          signatureData: signature,
        },
      });

      log.info('Work trip document created with employee signature', {
        documentId: document.id
      });
    }, undefined, 'Work trip document generation failed');
  }

  return NextResponse.json({
    success: true,
    workTripRequest,
  });
});
