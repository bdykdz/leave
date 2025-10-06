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
      
      await emailService.sendWFHRequestNotification(user.manager!.email, {
        employeeName: `${user.firstName} ${user.lastName}`,
        startDate: format(startDate, 'dd MMMM yyyy'),
        endDate: format(endDate, 'dd MMMM yyyy'),
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