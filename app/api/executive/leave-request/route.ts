import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { format } from 'date-fns';
import { log } from '@/lib/logger';
import { asyncHandler, safeAsync } from '@/lib/async-handler';
import { emailService } from '@/lib/email-service';
import { WorkingDaysService } from '@/lib/services/working-days-service';
import { hasActualDateOverlap } from '@/lib/utils/date-validation';
import { getSubstituteNames } from '@/lib/services/approval-workflow-service';
import { ValidationService } from '@/lib/validation-service';

// Helper class to abort transactions with a client-facing response
class TransactionAbort extends Error {
  statusCode: number;
  body: Record<string, unknown>;
  constructor(statusCode: number, body: Record<string, unknown>) {
    super('TransactionAbort');
    this.statusCode = statusCode;
    this.body = body;
  }
}

// Validation schema for executive leave request
const createExecutiveLeaveRequestSchema = z.object({
  leaveTypeId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string(),
  selectedDates: z.array(z.string()).optional(),
  signature: z.string(),
  executiveApproverId: z.string(),
  substituteIds: z.array(z.string()).min(1, 'At least one substitute is required'),
  isExecutiveRequest: z.boolean().optional(),
});

// POST /api/executive/leave-request - Create executive leave request
export const POST = asyncHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is an executive
  if (session.user.role !== 'EXECUTIVE') {
    return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
  }

  const body = await request.json();
  
  // Validate request body
  let validatedData;
  try {
    validatedData = createExecutiveLeaveRequestSchema.parse(body);
  } catch (error) {
    log.error('Request validation failed', { error, body });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Invalid request data' },
      { status: 400 }
    );
  }

  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get approver details
  const approver = await prisma.user.findUnique({
    where: { id: validatedData.executiveApproverId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    }
  });

  if (!approver) {
    return NextResponse.json({ error: 'Selected approver not found' }, { status: 404 });
  }

  // Verify approver is also an executive
  if (approver.role !== 'EXECUTIVE') {
    return NextResponse.json({ error: 'Selected approver must be an executive' }, { status: 400 });
  }

  // Calculate dates and total days (excluding weekends and holidays)
  const startDate = new Date(validatedData.startDate);
  const endDate = new Date(validatedData.endDate);
  
  let totalDays: number;
  if (validatedData.selectedDates?.length) {
    // If specific dates are selected, count only the working days among them
    const workingDaysService = WorkingDaysService.getInstance();
    totalDays = 0;
    
    for (const dateStr of validatedData.selectedDates) {
      const date = new Date(dateStr);
      if (await workingDaysService.isWorkingDay(date)) {
        totalDays++;
      }
    }
    
    if (totalDays === 0) {
      return NextResponse.json(
        { error: 'No working days selected. Please select at least one working day.' },
        { status: 400 }
      );
    }
  } else {
    // For date range, calculate working days between start and end
    const workingDaysService = WorkingDaysService.getInstance();
    totalDays = await workingDaysService.calculateWorkingDays(startDate, endDate, true);
  }

  // Fetch leave type for validation checks
  const requestedLeaveType = await prisma.leaveType.findUnique({
    where: { id: validatedData.leaveTypeId },
    select: { name: true, isHROnly: true, dateRestriction: true, maxDaysPerRequest: true, daysAllowed: true },
  });

  if (!requestedLeaveType) {
    return NextResponse.json({ error: 'Leave type not found' }, { status: 400 });
  }

  // Executives cannot self-service HR-only leave types
  if (requestedLeaveType.isHROnly) {
    return NextResponse.json(
      { error: `${requestedLeaveType.name} can only be recorded by HR. Please contact your HR department.` },
      { status: 403 }
    );
  }

  // Birthday window restriction
  if (requestedLeaveType.dateRestriction) {
    const restriction = requestedLeaveType.dateRestriction as { type?: string; windowDays?: number; beforeDays?: number; afterDays?: number };
    if (restriction.type === 'BIRTHDAY_WINDOW') {
      if (!user.dateOfBirth) {
        return NextResponse.json(
          { error: `To request ${requestedLeaveType.name}, your date of birth must be set. Please contact HR.` },
          { status: 400 }
        );
      }
      const beforeDays = restriction.beforeDays ?? restriction.windowDays ?? 10;
      const afterDays = restriction.afterDays ?? restriction.windowDays ?? 20;
      const requestYear = startDate.getFullYear();
      const birthMonth = user.dateOfBirth.getMonth();
      const birthDay = user.dateOfBirth.getDate();
      const birthday = new Date(requestYear, birthMonth, birthDay);
      if (birthday.getMonth() !== birthMonth) {
        birthday.setDate(0);
      }

      const windowStart = new Date(birthday);
      windowStart.setDate(windowStart.getDate() - beforeDays);
      const windowEnd = new Date(birthday);
      windowEnd.setDate(windowEnd.getDate() + afterDays);

      const datesToCheck = validatedData.selectedDates?.length
        ? validatedData.selectedDates.map((d: string) => new Date(d))
        : [startDate, endDate];

      for (const date of datesToCheck) {
        if (date < windowStart || date > windowEnd) {
          const formattedBirthday = birthday.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
          const formattedStart = windowStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
          const formattedEnd = windowEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
          return NextResponse.json(
            {
              error: `${requestedLeaveType.name} must be taken between ${formattedStart} and ${formattedEnd} (${beforeDays} days before to ${afterDays} days after your birthday on ${formattedBirthday}).`,
            },
            { status: 400 }
          );
        }
      }
    }
  }

  // Enforce maxDaysPerRequest
  if (requestedLeaveType.maxDaysPerRequest && totalDays > requestedLeaveType.maxDaysPerRequest) {
    return NextResponse.json(
      { error: `${requestedLeaveType.name} allows a maximum of ${requestedLeaveType.maxDaysPerRequest} day(s) per request. You requested ${totalDays} day(s).` },
      { status: 400 }
    );
  }

  // Yearly duplicate check for limited leave types (e.g. birthday leave)
  if (requestedLeaveType.daysAllowed && requestedLeaveType.daysAllowed <= 1) {
    const leaveYear = startDate.getFullYear();
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        userId: session.user.id,
        leaveTypeId: validatedData.leaveTypeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: {
          gte: new Date(`${leaveYear}-01-01`),
          lte: new Date(`${leaveYear}-12-31`),
        },
      },
    });
    if (existingRequest) {
      return NextResponse.json(
        { error: `You already have a ${requestedLeaveType.name} request for ${leaveYear}. Only one request per year is allowed.` },
        { status: 400 }
      );
    }
  }

  // Comprehensive validation (substitute eligibility, conflicts, etc.)
  const validationErrors = await ValidationService.validateLeaveRequest(
    session.user.id,
    {
      leaveTypeId: validatedData.leaveTypeId,
      startDate,
      endDate,
      totalDays,
      substituteIds: validatedData.substituteIds,
      selectedDates: validatedData.selectedDates?.map((d: string) => new Date(d)),
    }
  );

  if (validationErrors.length > 0) {
    log.warn('Executive leave request validation failed', {
      userId: session.user.id,
      errors: validationErrors,
    });
    return NextResponse.json(
      {
        error: 'Validation failed',
        errors: validationErrors,
      },
      { status: 400 }
    );
  }

  // Wrap overlap check, balance check, request creation, and balance update in a transaction
  // to prevent race conditions (#7, #17)
  const balanceYear = startDate.getFullYear();
  const requestNumberYear = new Date().getFullYear();
  const substituteNames = await getSubstituteNames(validatedData.substituteIds);

  let leaveRequest;
  try {
    leaveRequest = await prisma.$transaction(async (tx) => {
    // Check for overlapping leave requests
    const leaveCandidates = await tx.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true, startDate: true, endDate: true, selectedDates: true }
    });

    const incomingRequest = { startDate, endDate, selectedDates: validatedData.selectedDates?.map((d: string) => new Date(d)) };
    const overlappingLeave = leaveCandidates.find(c => hasActualDateOverlap(c, incomingRequest));

    if (overlappingLeave) {
      throw new TransactionAbort(400, {
        error: 'Date conflict',
        message: `You already have a leave request from ${overlappingLeave.startDate.toLocaleDateString()} to ${overlappingLeave.endDate.toLocaleDateString()}. Please choose different dates or cancel the existing request.`
      });
    }

    // Check for overlapping WFH requests
    const wfhCandidates = await tx.workFromHomeRequest.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true, startDate: true, endDate: true, selectedDates: true }
    });

    const overlappingWfh = wfhCandidates.find(c =>
      hasActualDateOverlap({ ...c, selectedDates: c.selectedDates as any[] | null }, incomingRequest)
    );

    if (overlappingWfh) {
      throw new TransactionAbort(400, {
        error: 'Date conflict',
        message: `You already have a work-from-home request from ${overlappingWfh.startDate.toLocaleDateString()} to ${overlappingWfh.endDate.toLocaleDateString()}. Please choose different dates or cancel the existing WFH request.`
      });
    }

    // Check leave balance (use leave start year, not current calendar year)
    const leaveBalance = await tx.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: session.user.id,
          leaveTypeId: validatedData.leaveTypeId,
          year: balanceYear,
        }
      }
    });

    if (!leaveBalance || leaveBalance.available < totalDays) {
      throw new TransactionAbort(400, {
        error: 'Insufficient leave balance',
        message: `You have ${leaveBalance?.available || 0} days available but are requesting ${totalDays} days.`
      });
    }

    // Generate request number inside transaction to prevent duplicates (#17)
    const requestCount = await tx.leaveRequest.count({
      where: {
        createdAt: {
          gte: new Date(`${requestNumberYear}-01-01`),
        },
      },
    });
    const requestNumber = `ELR-${requestNumberYear}-${String(requestCount + 1).padStart(4, '0')}`;

    // Create leave request with single executive approval
    const created = await tx.leaveRequest.create({
      data: {
        requestNumber,
        userId: session.user.id,
        leaveTypeId: validatedData.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason: validatedData.reason,
        substituteId: validatedData.substituteIds[0],
        status: 'PENDING',
        // Store selected dates as direct field for calendar filtering
        selectedDates: validatedData.selectedDates ?
          validatedData.selectedDates.map(dateStr => new Date(dateStr)) : [],
        // Store metadata about executive request
        supportingDocuments: {
          selectedDates: validatedData.selectedDates || null,
          substituteNames,
          isExecutiveRequest: true,
          executiveApproverId: validatedData.executiveApproverId,
        },
        // Create single approval for the selected executive
        approvals: {
          create: {
            approverId: validatedData.executiveApproverId,
            level: 1,
            status: 'PENDING',
          }
        },
      },
      include: {
        leaveType: true,
        substitute: true,
        approvals: {
          include: {
            // Fix #2: Only select safe fields to prevent password hash leak
            approver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              }
            },
          },
        },
      },
    });

    // Update leave balance (add to pending) — use balanceYear (leave start year)
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: session.user.id,
          leaveTypeId: validatedData.leaveTypeId,
          year: balanceYear,
        },
      },
      data: {
        pending: {
          increment: totalDays,
        },
        available: {
          decrement: totalDays,
        },
      },
    });

    return created;
  });
  } catch (error) {
    if (error instanceof TransactionAbort) {
      return NextResponse.json(error.body, { status: error.statusCode });
    }
    throw error;
  }

  // Create notification for approving executive
  await prisma.notification.create({
    data: {
      userId: validatedData.executiveApproverId,
      type: 'APPROVAL_REQUIRED',
      title: 'Executive Leave Request Approval Required',
      message: `${user.firstName} ${user.lastName} has requested ${totalDays} days of leave`,
      link: `/executive/approvals/${leaveRequest.id}`,
    },
  });

  // Send email notification to approving executive
  if (approver.email) {
    await safeAsync(async () => {
      log.info('Sending executive leave request email', {
        requestId: leaveRequest.id,
        to: approver.email,
      });
      
      // Format dates for email
      const formattedDates = validatedData.selectedDates && validatedData.selectedDates.length > 0
        ? formatSelectedDates(validatedData.selectedDates)
        : `${format(startDate, 'dd MMMM yyyy')} - ${format(endDate, 'dd MMMM yyyy')}`;
      
      await emailService.sendLeaveRequestNotification(approver.email, {
        employeeName: `${user.firstName} ${user.lastName}`,
        leaveType: leaveRequest.leaveType.name,
        startDate: format(startDate, 'dd MMMM yyyy'),
        endDate: format(endDate, 'dd MMMM yyyy'),
        days: totalDays,
        reason: validatedData.reason || undefined,
        managerName: `${approver.firstName} ${approver.lastName}`,
        companyName: process.env.COMPANY_NAME || 'TPF',
        requestId: leaveRequest.id
      });
      
      log.info('Executive leave request email sent', { to: approver.email });
    }, undefined, 'Failed to send email notification');
  }

  return NextResponse.json({
    success: true,
    leaveRequest,
    message: 'Leave request submitted successfully for executive approval'
  });
});

// Helper function to format selected dates
function formatSelectedDates(selectedDates: string[]): string {
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