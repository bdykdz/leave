import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { format } from 'date-fns';
import { log } from '@/lib/logger';
import { asyncHandler, safeAsync } from '@/lib/async-handler';
import { WFHValidationService } from '@/lib/wfh-validation-service';
import { emailService } from '@/lib/email-service';

const prisma = new PrismaClient();

// Validation schema for WFH request
const createWFHRequestSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  selectedDates: z.array(z.string()).optional(),
  location: z.string().min(1),
  signature: z.string().optional(),
});

// Format WFH dates for display (e.g., "1-5 July 2024" or "9, 17-24 July 2024")
function formatWFHDates(startDate: Date, endDate: Date, selectedDates?: string[] | null): string {
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
    const start = format(startDate, 'dd MMMM yyyy');
    const end = format(endDate, 'dd MMMM yyyy');
    
    // Single day
    if (startDate.toDateString() === endDate.toDateString()) {
      return start;
    }
    
    // Multiple days in same month
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

// GET /api/wfh-requests - Get user's WFH requests
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

  log.debug('Fetching WFH requests', { 
    userId: session.user.id,
    where 
  });

  const wfhRequests = await prisma.workFromHomeRequest.findMany({
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

  log.info('WFH requests fetched', { count: wfhRequests.length });

  return NextResponse.json({ wfhRequests });
});

// POST /api/wfh-requests - Create a new WFH request
export const POST = asyncHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  
  // Validate request body
  const validatedData = createWFHRequestSchema.parse(body);
  
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

  // Check for overlapping requests
  const overlappingWFH = await prisma.workFromHomeRequest.findFirst({
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

  if (overlappingWFH) {
    return NextResponse.json(
      { 
        error: 'Date conflict',
        message: `You already have a work from home request from ${overlappingWFH.startDate.toLocaleDateString()} to ${overlappingWFH.endDate.toLocaleDateString()}. Please choose different dates or cancel the existing request.`
      },
      { status: 400 }
    );
  }

  if (overlappingLeave) {
    return NextResponse.json(
      { 
        error: 'Date conflict',
        message: `You have a leave request from ${overlappingLeave.startDate.toLocaleDateString()} to ${overlappingLeave.endDate.toLocaleDateString()}. You cannot work from home while on leave.`
      },
      { status: 400 }
    );
  }

  // Perform validation
  const validationErrors = await WFHValidationService.validateWFHRequest(
    session.user.id,
    {
      startDate,
      endDate,
      selectedDates: validatedData.selectedDates?.map(d => new Date(d)),
      location: validatedData.location,
    }
  );

  if (validationErrors.length > 0) {
    log.warn('WFH request validation failed', {
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

  // Generate request number
  const currentYear = new Date().getFullYear();
  const requestCount = await prisma.workFromHomeRequest.count({
    where: {
      createdAt: {
        gte: new Date(`${currentYear}-01-01`),
      },
    },
  });
  const requestNumber = `WFH-${currentYear}-${String(requestCount + 1).padStart(4, '0')}`;

  // Create WFH request with approval for manager
  const wfhRequest = await prisma.workFromHomeRequest.create({
    data: {
      requestNumber,
      userId: session.user.id,
      startDate,
      endDate,
      selectedDates: validatedData.selectedDates || null,
      totalDays,
      location: validatedData.location,
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
    await prisma.notification.create({
      data: {
        userId: user.managerId,
        type: 'APPROVAL_REQUIRED',
        title: 'WFH Request Approval Required',
        message: `${user.firstName} ${user.lastName} has requested ${totalDays} days of work from home`,
        link: `/manager/wfh-approvals/${wfhRequest.id}`,
      },
    });
  }

  // Send email notification to manager
  if (user.manager?.email) {
    await safeAsync(async () => {
      log.info('Sending WFH email notification', {
        requestId: wfhRequest.id,
        to: user.manager!.email,
      });
      
      // Format dates properly for email
      const formattedDates = formatWFHDates(startDate, endDate, validatedData.selectedDates);
      
      await emailService.sendWFHRequestNotification(user.manager!.email, {
        employeeName: `${user.firstName} ${user.lastName}`,
        startDate: formattedDates,  // Use formatted dates string
        endDate: '',  // Not needed when using formatted dates
        days: totalDays,
        location: validatedData.location,
        managerName: `${user.manager!.firstName} ${user.manager!.lastName}`,
        requestId: wfhRequest.id,
      });
      
      log.info('WFH email sent', { to: user.manager!.email });
    }, undefined, 'Failed to send WFH email notification');
  }

  // Generate document if signature provided
  if (signature) {
    await safeAsync(async () => {
      const document = await prisma.wFHDocument.create({
        data: {
          wfhRequestId: wfhRequest.id,
          status: 'PENDING_SIGNATURES',
        },
      });

      // Add employee signature
      await prisma.wFHSignature.create({
        data: {
          documentId: document.id,
          signerId: session.user.id,
          signerRole: 'employee',
          signatureData: signature,
        },
      });

      log.info('WFH document created with employee signature', { 
        documentId: document.id 
      });
    }, undefined, 'WFH document generation failed');
  }

  return NextResponse.json({
    success: true,
    wfhRequest,
  });
});