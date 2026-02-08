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

// Validation schema for executive leave request
const createExecutiveLeaveRequestSchema = z.object({
  leaveTypeId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string(),
  selectedDates: z.array(z.string()).optional(),
  signature: z.string(),
  executiveApproverId: z.string(),
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

  // Check for overlapping leave requests
  const overlappingLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ['APPROVED', 'PENDING'] },
      OR: [
        {
          startDate: { lte: endDate },
          endDate: { gte: startDate }
        }
      ]
    }
  });

  if (overlappingLeave) {
    return NextResponse.json(
      { 
        error: 'Date conflict',
        message: `You already have a leave request from ${overlappingLeave.startDate.toLocaleDateString()} to ${overlappingLeave.endDate.toLocaleDateString()}. Please choose different dates or cancel the existing request.`
      },
      { status: 400 }
    );
  }

  // Check leave balance
  const currentYear = new Date().getFullYear();
  const leaveBalance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId: session.user.id,
        leaveTypeId: validatedData.leaveTypeId,
        year: currentYear,
      }
    }
  });

  if (!leaveBalance || leaveBalance.available < totalDays) {
    return NextResponse.json(
      { 
        error: 'Insufficient leave balance',
        message: `You have ${leaveBalance?.available || 0} days available but are requesting ${totalDays} days.`
      },
      { status: 400 }
    );
  }

  // Generate request number
  const requestCount = await prisma.leaveRequest.count({
    where: {
      createdAt: {
        gte: new Date(`${currentYear}-01-01`),
      },
    },
  });
  const requestNumber = `ELR-${currentYear}-${String(requestCount + 1).padStart(4, '0')}`;

  // Create leave request with single executive approval
  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      requestNumber,
      userId: session.user.id,
      leaveTypeId: validatedData.leaveTypeId,
      startDate,
      endDate,
      totalDays,
      reason: validatedData.reason,
      status: 'PENDING',
      // Store selected dates as direct field for calendar filtering
      selectedDates: validatedData.selectedDates ? 
        validatedData.selectedDates.map(dateStr => new Date(dateStr)) : [],
      // Store metadata about executive request
      supportingDocuments: {
        selectedDates: validatedData.selectedDates || null,
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
      approvals: {
        include: {
          approver: true,
        },
      },
    },
  });

  // Update leave balance (add to pending)
  await prisma.leaveBalance.update({
    where: {
      userId_leaveTypeId_year: {
        userId: session.user.id,
        leaveTypeId: validatedData.leaveTypeId,
        year: currentYear,
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
        companyName: process.env.COMPANY_NAME || 'Company',
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