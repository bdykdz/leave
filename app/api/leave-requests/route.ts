import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { DelegationService } from '@/lib/services/delegation-service';
import { z } from 'zod';
import { SmartDocumentGenerator } from '@/lib/smart-document-generator';
import { emailService } from '@/lib/email-service';
import { format, eachDayOfInterval } from 'date-fns';
import { log } from '@/lib/logger';
import { asyncHandler, safeAsync } from '@/lib/async-handler';
import { ValidationService } from '@/lib/validation-service';
import { WorkingDaysService } from '@/lib/services/working-days-service';
import { checkSelectedDatesOverlap, checkHolidayConflicts, hasActualDateOverlap } from '@/lib/utils/date-validation';
import { generateApprovalWorkflow, getSubstituteNames } from '@/lib/services/approval-workflow-service';
const documentGenerator = new SmartDocumentGenerator();

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

// Validation schema for leave request
const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string(), // No minimum length requirement
  substituteIds: z.array(z.string()).optional(),
  selectedDates: z.array(z.string()).optional(), // For non-consecutive dates
  signature: z.string().optional(), // Employee signature from form
});

// Format dates for display (e.g., "1-5 July 2024" or "9, 17-24 July 2024")
function formatLeaveDates(startDate: Date, endDate: Date, selectedDates?: string[]): string {
  if (selectedDates && selectedDates.length > 0) {
    // Parse selected dates and group consecutive ones
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
    // Simple date range
    const start = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const end = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Single day leave
    if (startDate.toDateString() === endDate.toDateString()) {
      return start;
    }
    
    // Multiple days in same month
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.getDate()}-${endDate.getDate()} ${startDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
    } else {
      return `${start} - ${end}`;
    }
  }
}

function formatDateGroup(dates: Date[]): string {
  if (dates.length === 1) {
    return dates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } else {
    const first = dates[0].getDate();
    const last = dates[dates.length - 1].getDate();
    const month = dates[0].toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return `${first}-${last} ${month}`;
  }
}

// GET /api/leave-requests - Get user's leave requests
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

    // Filter by year only if not "all"
    if (year !== 'all') {
      where.startDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }

    log.debug('Fetching leave requests', { 
      userId: session.user.id,
      where 
    });

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: true,
        substitute: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
          },
        },
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
          orderBy: {
            level: 'asc',
          },
        },
        generatedDocument: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // Process leave requests to include selectedDates and supportingDocuments
    const processedRequests = leaveRequests.map(request => ({
      ...request,
      selectedDates: request.selectedDates || [], // Include selectedDates array
      supportingDocuments: request.supportingDocuments || {}, // Include supportingDocuments
    }));

    log.info('Leave requests fetched', { count: processedRequests.length });

    return NextResponse.json({ leaveRequests: processedRequests });
});

// POST /api/leave-requests - Create a new leave request
export const POST = asyncHandler(async (request: NextRequest) => {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate request body
    let validatedData;
    try {
      validatedData = createLeaveRequestSchema.parse(body);
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
    
    // Extract signature separately (not in validated data)
    const signature = body.signature || null;

    // Get user details including manager
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        manager: true,
        departmentDirector: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate total days
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    // Check if leave type exists and is not HR-only
    const requestedLeaveType = await prisma.leaveType.findUnique({
      where: { id: validatedData.leaveTypeId },
      select: { dateRestriction: true, name: true, isHROnly: true, maxDaysPerRequest: true, daysAllowed: true },
    });

    if (!requestedLeaveType) {
      return NextResponse.json({ error: 'Leave type not found' }, { status: 400 });
    }

    if (requestedLeaveType.isHROnly) {
      return NextResponse.json(
        { error: `${requestedLeaveType.name} can only be recorded by HR. Please contact your HR department.` },
        { status: 403 }
      );
    }

    // Check birthday window restriction for provisional leave types

    if (requestedLeaveType?.dateRestriction) {
      const restriction = requestedLeaveType.dateRestriction as { type?: string; windowDays?: number; beforeDays?: number; afterDays?: number };
      if (restriction.type === 'BIRTHDAY_WINDOW') {
        if (!user.dateOfBirth) {
          return NextResponse.json(
            { error: `To request ${requestedLeaveType.name}, your date of birth must be set. Please contact HR.` },
            { status: 400 }
          );
        }
        // Support asymmetric window (beforeDays/afterDays) with fallback to legacy symmetric windowDays
        const beforeDays = restriction.beforeDays ?? restriction.windowDays ?? 10;
        const afterDays = restriction.afterDays ?? restriction.windowDays ?? 20;
        const requestYear = startDate.getFullYear();
        // Handle leap year: if born Feb 29 and request year is not a leap year, use Feb 28
        const birthMonth = user.dateOfBirth.getMonth();
        const birthDay = user.dateOfBirth.getDate();
        const birthday = new Date(requestYear, birthMonth, birthDay);
        // If the date rolled over (e.g. Feb 29 → Mar 1), use Feb 28 instead
        if (birthday.getMonth() !== birthMonth) {
          birthday.setDate(0); // Go to last day of previous month (Feb 28)
        }

        const windowStart = new Date(birthday);
        windowStart.setDate(windowStart.getDate() - beforeDays);
        const windowEnd = new Date(birthday);
        windowEnd.setDate(windowEnd.getDate() + afterDays);

        // Check each requested date against the birthday window
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
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate actual working days, excluding weekends and holidays
    let actualDays: number;
    
    if (validatedData.selectedDates?.length) {
      // Check for holiday conflicts
      const holidayCheck = await checkHolidayConflicts(validatedData.selectedDates);
      if (holidayCheck.hasConflict) {
        return NextResponse.json(
          { 
            error: 'Holiday conflict',
            message: holidayCheck.message,
            blockedDates: holidayCheck.blockedDates
          },
          { status: 400 }
        );
      }
      
      // Check for overlapping dates with existing requests
      const overlapCheck = await checkSelectedDatesOverlap(
        session.user.id,
        validatedData.selectedDates
      );
      if (overlapCheck.hasOverlap) {
        return NextResponse.json(
          { 
            error: 'Date conflict',
            message: overlapCheck.message,
            conflictingDates: overlapCheck.conflictingDates
          },
          { status: 400 }
        );
      }
      
      // If specific dates are selected, count only the working days among them
      const workingDaysService = WorkingDaysService.getInstance();
      actualDays = 0;
      
      for (const dateStr of validatedData.selectedDates) {
        const date = new Date(dateStr);
        if (await workingDaysService.isWorkingDay(date)) {
          actualDays++;
        }
      }
      
      // If no working days selected, reject the request
      if (actualDays === 0) {
        return NextResponse.json(
          { error: 'No working days selected. Please select at least one working day.' },
          { status: 400 }
        );
      }
    } else {
      // For date range, also check for blocked holiday conflicts
      const allDatesInRange = eachDayOfInterval({ start: startDate, end: endDate })
        .map(d => d.toISOString().split('T')[0]);
      const holidayCheck = await checkHolidayConflicts(allDatesInRange);
      if (holidayCheck.hasConflict) {
        return NextResponse.json(
          {
            error: 'Holiday conflict',
            message: holidayCheck.message,
            blockedDates: holidayCheck.blockedDates
          },
          { status: 400 }
        );
      }

      // Check for overlapping dates with existing requests (date-range path)
      const overlapCheck = await checkSelectedDatesOverlap(
        session.user.id,
        allDatesInRange
      );
      if (overlapCheck.hasOverlap) {
        return NextResponse.json(
          {
            error: 'Date conflict',
            message: overlapCheck.message,
            conflictingDates: overlapCheck.conflictingDates
          },
          { status: 400 }
        );
      }

      // For date range, calculate working days between start and end
      const workingDaysService = WorkingDaysService.getInstance();
      actualDays = await workingDaysService.calculateWorkingDays(startDate, endDate, true);
    }

    // Yearly duplicate check for limited leave types (e.g. birthday leave with daysAllowed=1)
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

    // Enforce maxDaysPerRequest server-side
    if (requestedLeaveType.maxDaysPerRequest && actualDays > requestedLeaveType.maxDaysPerRequest) {
      return NextResponse.json(
        { error: `${requestedLeaveType.name} allows a maximum of ${requestedLeaveType.maxDaysPerRequest} day(s) per request. You requested ${actualDays} day(s).` },
        { status: 400 }
      );
    }

    // Perform comprehensive validation
    const validationErrors = await ValidationService.validateLeaveRequest(
      session.user.id,
      {
        leaveTypeId: validatedData.leaveTypeId,
        startDate,
        endDate,
        totalDays: actualDays,
        substituteIds: validatedData.substituteIds,
        selectedDates: validatedData.selectedDates?.map((d: string) => new Date(d)),
      }
    );

    if (validationErrors.length > 0) {
      log.warn('Leave request validation failed', {
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

    // Balance year is based on the leave's start date, not today
    const requestNumberYear = new Date().getFullYear();
    const balanceYear = startDate.getFullYear();

    // Format leave dates for display
    const formattedDates = formatLeaveDates(startDate, endDate, validatedData.selectedDates);

    const uploadedDocumentUrls: string[] = [];

    // Pre-compute data needed inside the transaction
    const approvalWorkflow = await generateApprovalWorkflow(user, validatedData.leaveTypeId, actualDays);
    const substituteNames = validatedData.substituteIds
      ? await getSubstituteNames(validatedData.substituteIds)
      : null;

    // Create leave request + update balance atomically to prevent race conditions
    let leaveRequest;
    try {
      leaveRequest = await prisma.$transaction(async (tx) => {
        // Check for overlapping leave requests inside transaction to prevent race conditions
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

        // Check for overlapping WFH requests inside transaction
        const wfhCandidates = await tx.workFromHomeRequest.findMany({
          where: {
            userId: session.user.id,
            status: { in: ['APPROVED', 'PENDING'] },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { id: true, startDate: true, endDate: true, selectedDates: true }
        });

        const overlappingWFH = wfhCandidates.find(c =>
          hasActualDateOverlap({ ...c, selectedDates: c.selectedDates as any[] | null }, incomingRequest)
        );

        if (overlappingWFH) {
          throw new TransactionAbort(400, {
            error: 'Date conflict',
            message: `You have a work from home request from ${overlappingWFH.startDate.toLocaleDateString()} to ${overlappingWFH.endDate.toLocaleDateString()}. You cannot be on leave and working from home on the same dates.`
          });
        }

        // Generate request number inside transaction to prevent duplicates
        const requestCount = await tx.leaveRequest.count({
          where: {
            createdAt: {
              gte: new Date(`${requestNumberYear}-01-01`),
            },
          },
        });
        const requestNumber = `LR-${requestNumberYear}-${String(requestCount + 1).padStart(4, '0')}`;

        // Re-check balance inside transaction (defense-in-depth against race conditions)
        const balance = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: session.user.id,
              leaveTypeId: validatedData.leaveTypeId,
              year: balanceYear,
            },
          },
        });
        if (!balance || balance.available < actualDays) {
          throw new Error(`Insufficient leave balance. Available: ${balance?.available ?? 0} days, Required: ${actualDays} days.`);
        }

        const created = await tx.leaveRequest.create({
          data: {
            requestNumber,
            userId: session.user.id,
            leaveTypeId: validatedData.leaveTypeId,
            startDate,
            endDate,
            totalDays: actualDays,
            reason: validatedData.reason,
            substituteId: validatedData.substituteIds?.[0],
            status: 'PENDING',
            selectedDates: validatedData.selectedDates
              ? validatedData.selectedDates.map(dateStr => new Date(dateStr))
              : [],
            supportingDocuments: {
              selectedDates: validatedData.selectedDates || null,
              formattedDates: formattedDates,
              substituteNames,
              employeeSignature: signature,
              employeeSignatureDate: new Date().toISOString().split('T')[0],
              uploadedDocuments: uploadedDocumentUrls,
              documentUploadDate: uploadedDocumentUrls.length > 0 ? new Date().toISOString() : null,
            },
            approvals: {
              create: approvalWorkflow,
            },
          },
          include: {
            leaveType: true,
            substitute: true,
            approvals: {
              include: {
                approver: true,
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
              increment: actualDays,
            },
            available: {
              decrement: actualDays,
            },
          },
        });

        return created;
      });
    } catch (dbError) {
      // Surface TransactionAbort as client-facing responses
      if (dbError instanceof TransactionAbort) {
        return NextResponse.json(dbError.body, { status: dbError.statusCode });
      }
      // Surface balance errors as 400, not 500
      if (dbError instanceof Error && dbError.message.startsWith('Insufficient leave balance')) {
        return NextResponse.json({ error: dbError.message }, { status: 400 });
      }
      log.error('Database operation failed', {
        error: dbError,
      });

      throw dbError;
    }

    // Create notifications for approvers
    const firstApprover = leaveRequest.approvals.find(a => a.level === 1);
    if (firstApprover) {
      // Check if approver is HR employee
      const approverUser = await prisma.user.findUnique({
        where: { id: firstApprover.approverId },
        select: { role: true, department: true }
      });
      
      // Determine the appropriate dashboard link based on approver's role/department
      let notificationLink = `/manager?request=${leaveRequest.id}`;
      if (approverUser) {
        if (approverUser.role === 'HR' || 
            (approverUser.role === 'EMPLOYEE' && (approverUser.department?.toLowerCase() === 'hr' || approverUser.department?.toLowerCase() === 'human resources'))) {
          notificationLink = `/hr?request=${leaveRequest.id}`;
        } else if (approverUser.role === 'EXECUTIVE') {
          notificationLink = `/executive?request=${leaveRequest.id}`;
        }
      }
      
      await safeAsync(async () => {
        await prisma.notification.create({
          data: {
            userId: firstApprover.approverId,
            type: 'APPROVAL_REQUIRED',
            title: 'Leave Request Approval Required',
            message: `${user.firstName} ${user.lastName} has requested ${actualDays} days of leave`,
            link: notificationLink,
          },
        });
      }, undefined, `Failed to create notification for approver ${firstApprover.approverId}`);

      // Additive delegation: also notify anyone currently covering this approver's duties
      const approverDelegateIds = await DelegationService.getActiveDelegateIdsFor(firstApprover.approverId);
      for (const delegateId of approverDelegateIds) {
        await safeAsync(async () => {
          await prisma.notification.create({
            data: {
              userId: delegateId,
              type: 'APPROVAL_REQUIRED',
              title: 'Leave Request Approval Required (delegated)',
              message: `${user.firstName} ${user.lastName} has requested ${actualDays} days of leave — you are covering approvals.`,
              link: notificationLink,
            },
          });
        }, undefined, `Failed to notify delegate ${delegateId}`);
      }
    }

    // Check if this is sick leave using the already fetched leave type
    const isSickLeave = leaveRequest.leaveType.code === 'SL';
    
    // Special handling for sick leave - notify ALL HR users
    if (isSickLeave) {
      const hrUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { role: 'HR' },
            { 
              role: 'EMPLOYEE',
              department: { contains: 'hr', mode: 'insensitive' }
            }
          ]
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });

      log.info('Sick leave submitted - notifying all HR users', {
        requestId: leaveRequest.id,
        requestNumber: leaveRequest.requestNumber,
        hrUserCount: hrUsers.length,
        documentsUploaded: uploadedDocumentUrls.length
      });

      // Send notifications and emails to all HR users
      for (const hrUser of hrUsers) {
        // Create notification
        await safeAsync(async () => {
          await prisma.notification.create({
            data: {
              userId: hrUser.id,
              type: 'APPROVAL_REQUIRED',
              title: 'Sick Leave Verification Required',
              message: `${user.firstName} ${user.lastName} has submitted sick leave requiring verification`,
              link: `/hr?tab=verification&request=${leaveRequest.id}`,
            },
          });
        }, undefined, `Failed to create notification for HR user ${hrUser.id}`);

        // Send email
        await safeAsync(async () => {
          await emailService.sendLeaveRequestNotification(hrUser.email, {
            employeeName: `${user.firstName} ${user.lastName}`,
            leaveType: 'Sick Leave - Medical Verification Required',
            startDate: format(startDate, 'dd MMMM yyyy'),
            endDate: format(endDate, 'dd MMMM yyyy'),
            days: actualDays,
            reason: `Medical leave requiring document verification`,
            managerName: `${hrUser.firstName} ${hrUser.lastName}`,
            companyName: process.env.COMPANY_NAME || 'TPF',
            requestId: leaveRequest.id
          });
          
          log.info('Sick leave email sent to HR', {
            to: hrUser.email,
            requestNumber: leaveRequest.requestNumber
          });
        }, undefined, `Failed to send sick leave email to ${hrUser.email}`);
      }
    }

    // Notify all HR users for non-sick special leave types that require HR verification
    const isSpecialLeaveNotSick = !isSickLeave && leaveRequest.leaveType.requiresHRVerification;
    if (isSpecialLeaveNotSick) {
      const hrUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { role: 'HR' },
            {
              role: 'EMPLOYEE',
              department: { contains: 'hr', mode: 'insensitive' }
            }
          ]
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });

      log.info('Special leave submitted - notifying all HR users', {
        requestId: leaveRequest.id,
        requestNumber: leaveRequest.requestNumber,
        leaveType: leaveRequest.leaveType.code,
        hrUserCount: hrUsers.length,
        documentsUploaded: uploadedDocumentUrls.length
      });

      for (const hrUser of hrUsers) {
        // Skip the first approver — they already get notified above
        if (firstApprover && hrUser.id === firstApprover.approverId) continue;

        // Create in-app notification
        await safeAsync(async () => {
          await prisma.notification.create({
            data: {
              userId: hrUser.id,
              type: 'APPROVAL_REQUIRED',
              title: 'Document Verification Required',
              message: `${user.firstName} ${user.lastName} has submitted ${leaveRequest.leaveType.name} requiring verification`,
              link: `/hr?tab=verification&request=${leaveRequest.id}`,
            },
          });
        }, undefined, `Failed to create notification for HR user ${hrUser.id}`);

        // Send email
        await safeAsync(async () => {
          await emailService.sendLeaveRequestNotification(hrUser.email, {
            employeeName: `${user.firstName} ${user.lastName}`,
            leaveType: `${leaveRequest.leaveType.name} - Document Verification Required`,
            startDate: format(startDate, 'dd MMMM yyyy'),
            endDate: format(endDate, 'dd MMMM yyyy'),
            days: actualDays,
            reason: `${leaveRequest.leaveType.name} requiring document verification`,
            managerName: `${hrUser.firstName} ${hrUser.lastName}`,
            companyName: process.env.COMPANY_NAME || 'TPF',
            requestId: leaveRequest.id
          });

          log.info('Special leave email sent to HR', {
            to: hrUser.email,
            requestNumber: leaveRequest.requestNumber,
            leaveType: leaveRequest.leaveType.code
          });
        }, undefined, `Failed to send special leave email to ${hrUser.email}`);
      }
    }

    // Send email notification to the first approver (for all leave types)
    if (firstApprover?.approver?.email) {
      await safeAsync(async () => {
        log.info('Sending email notification', {
          requestId: leaveRequest.id,
          requester: `${user.firstName} ${user.lastName}`,
          requesterRole: user.role,
          approver: `${firstApprover.approver.firstName} ${firstApprover.approver.lastName}`,
          approverEmail: firstApprover.approver.email
        });
        
        await emailService.sendLeaveRequestNotification(firstApprover.approver.email, {
          employeeName: `${user.firstName} ${user.lastName}`,
          leaveType: leaveRequest.leaveType.name,
          startDate: format(startDate, 'dd MMMM yyyy'),
          endDate: format(endDate, 'dd MMMM yyyy'),
          days: actualDays,
          reason: validatedData.reason || undefined,
          managerName: `${firstApprover.approver.firstName} ${firstApprover.approver.lastName}`,
          companyName: process.env.COMPANY_NAME || 'TPF',
          requestId: leaveRequest.id
        });
        log.info('Email notification sent', { to: firstApprover.approver.email });
      }, undefined, 'Failed to send email notification');
    } else {
      log.warn('No approver email found', {
        requestId: leaveRequest.id,
        hasFirstApprover: !!firstApprover,
        hasApproverData: !!firstApprover?.approver,
        approverId: firstApprover?.approverId
      });
    }

    // Automatically generate document for the leave request
    try {
      log.info('Generating document', { requestId: leaveRequest.id });
      
      // Get the leave type and check for active templates
      const leaveType = await prisma.leaveType.findUnique({
        where: { id: validatedData.leaveTypeId },
        include: {
          documentTemplates: {
            where: { isActive: true },
            orderBy: { version: 'desc' },
            take: 1
          }
        }
      });
      
      if (leaveType && leaveType.documentTemplates.length > 0) {
        const template = leaveType.documentTemplates[0];
        const documentId = await documentGenerator.generateDocument(leaveRequest.id, template.id);
        log.info('Document generated', { documentId });
        
        // Add employee signature if provided
        if (signature) {
          await documentGenerator.addSignature(
            documentId,
            session.user.id,
            'employee',
            signature
          );
          log.info('Employee signature added to document');
        }
      } else {
        log.warn('No active template found', { leaveType: leaveType?.name });
      }
    } catch (docError) {
      log.error('Document generation failed', docError);
      // Don't fail the request if document generation fails
      // Document can be generated later manually
    }

    return NextResponse.json({
      success: true,
      leaveRequest,
    });
});

// generateApprovalWorkflow and getSubstituteNames are now imported from '@/lib/services/approval-workflow-service'