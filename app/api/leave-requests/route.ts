import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { SmartDocumentGenerator } from '@/lib/smart-document-generator';
import { emailService } from '@/lib/email-service';
import { format } from 'date-fns';
import { log } from '@/lib/logger';
import { asyncHandler, safeAsync } from '@/lib/async-handler';
import { ValidationService } from '@/lib/validation-service';
import { WorkingDaysService } from '@/lib/services/working-days-service';
import { checkSelectedDatesOverlap, checkHolidayConflicts } from '@/lib/utils/date-validation';
import { uploadToMinio, generateSupportingDocumentName, deleteFromMinio } from '@/lib/minio';
const documentGenerator = new SmartDocumentGenerator();

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

    // Check content type to handle both JSON and FormData
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let uploadedFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (file uploads)
      const formData = await request.formData();
      body = {};
      
      // Extract form fields
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('supportingDocument_')) {
          uploadedFiles.push(value as File);
        } else if (key === 'substituteIds' || key === 'selectedDates') {
          body[key] = JSON.parse(value as string);
        } else {
          body[key] = value;
        }
      }
      
      // Server-side file validation
      if (uploadedFiles.length > 0) {
        const fileErrors: string[] = [];
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        const maxFileSize = 5 * 1024 * 1024; // 5MB
        
        uploadedFiles.forEach((file, index) => {
          if (!allowedTypes.includes(file.type)) {
            fileErrors.push(`File ${index + 1}: Invalid file type. Only JPEG, PNG, and PDF files are allowed.`);
          }
          if (file.size > maxFileSize) {
            fileErrors.push(`File ${index + 1}: File size too large. Maximum size is 5MB.`);
          }
          if (file.size === 0) {
            fileErrors.push(`File ${index + 1}: Empty file detected.`);
          }
        });
        
        if (fileErrors.length > 0) {
          log.warn('File validation failed', { errors: fileErrors, userId: session.user.id });
          return NextResponse.json(
            { 
              error: 'File validation failed',
              details: fileErrors
            },
            { status: 400 }
          );
        }
      }
    } else {
      // Handle JSON
      body = await request.json();
    }
    
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
      // For date range, calculate working days between start and end
      const workingDaysService = WorkingDaysService.getInstance();
      actualDays = await workingDaysService.calculateWorkingDays(startDate, endDate, true);
    }

    // Check for overlapping requests
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

    if (overlappingLeave) {
      return NextResponse.json(
        { 
          error: 'Date conflict',
          message: `You already have a leave request from ${overlappingLeave.startDate.toLocaleDateString()} to ${overlappingLeave.endDate.toLocaleDateString()}. Please choose different dates or cancel the existing request.`
        },
        { status: 400 }
      );
    }

    if (overlappingWFH) {
      return NextResponse.json(
        { 
          error: 'Date conflict',
          message: `You have a work from home request from ${overlappingWFH.startDate.toLocaleDateString()} to ${overlappingWFH.endDate.toLocaleDateString()}. You cannot be on leave and working from home on the same dates.`
        },
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

    // Generate request number
    const currentYear = new Date().getFullYear();
    const requestCount = await prisma.leaveRequest.count({
      where: {
        createdAt: {
          gte: new Date(`${currentYear}-01-01`),
        },
      },
    });
    const requestNumber = `LR-${currentYear}-${String(requestCount + 1).padStart(4, '0')}`;

    // Format leave dates for display
    const formattedDates = formatLeaveDates(startDate, endDate, validatedData.selectedDates);

    // Handle file uploads for supporting documents
    let uploadedDocumentUrls: string[] = [];
    if (uploadedFiles.length > 0) {
      try {
        log.info('Uploading supporting documents', { 
          requestNumber, 
          fileCount: uploadedFiles.length,
          userEmail: user.email 
        });
        
        const uploadPromises = uploadedFiles.map(async (file, index) => {
          const fileBuffer = Buffer.from(await file.arrayBuffer());
          const fileName = generateSupportingDocumentName(
            requestNumber,
            user.email,
            file.name
          );
          
          return await uploadToMinio(
            fileBuffer,
            fileName,
            file.type,
            undefined, // use default bucket
            'documents/supporting'
          );
        });
        
        uploadedDocumentUrls = await Promise.all(uploadPromises);
        log.info('Supporting documents uploaded', { 
          requestNumber,
          uploadedUrls: uploadedDocumentUrls 
        });
      } catch (uploadError) {
        log.error('Failed to upload supporting documents', { 
          requestNumber,
          error: uploadError 
        });
        // Clean up any partially uploaded files
        if (uploadedDocumentUrls.length > 0) {
          await safeAsync(async () => {
            for (const url of uploadedDocumentUrls) {
              const filePath = url.replace('minio://', '').replace('leave-management/', '');
              await deleteFromMinio(filePath);
            }
          }, undefined, 'Failed to cleanup uploaded files after error');
        }
        return NextResponse.json(
          { error: 'Failed to upload supporting documents' },
          { status: 500 }
        );
      }
    }

    // Create leave request with approval workflow
    let leaveRequest;
    try {
      leaveRequest = await prisma.leaveRequest.create({
      data: {
        requestNumber,
        userId: session.user.id,
        leaveTypeId: validatedData.leaveTypeId,
        startDate,
        endDate,
        totalDays: actualDays,
        reason: validatedData.reason,
        substituteId: validatedData.substituteIds?.[0], // For now, take the first substitute
        status: 'PENDING',
        // Store selected dates as direct field for calendar filtering
        selectedDates: validatedData.selectedDates ? 
          validatedData.selectedDates.map(dateStr => new Date(dateStr)) : [],
        // Store selected dates and formatted dates in supportingDocuments for backward compatibility
        supportingDocuments: {
          selectedDates: validatedData.selectedDates || null,
          formattedDates: formattedDates,
          substituteNames: validatedData.substituteIds ? 
            await getSubstituteNames(validatedData.substituteIds) : null,
          employeeSignature: signature, // Store employee signature
          employeeSignatureDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          uploadedDocuments: uploadedDocumentUrls, // Store uploaded document URLs
          documentUploadDate: uploadedDocumentUrls.length > 0 ? new Date().toISOString() : null,
        },
        approvals: {
          create: await generateApprovalWorkflow(user, validatedData.leaveTypeId, actualDays),
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
          increment: actualDays,
        },
        available: {
          decrement: actualDays,
        },
      },
    });
    } catch (dbError) {
      log.error('Database operation failed, cleaning up uploaded files', { 
        requestNumber,
        uploadedUrls: uploadedDocumentUrls,
        error: dbError 
      });
      
      // Rollback: Delete uploaded files if database creation failed
      if (uploadedDocumentUrls.length > 0) {
        await safeAsync(async () => {
          for (const url of uploadedDocumentUrls) {
            const filePath = url.replace('minio://', '').replace('leave-management/', '');
            await deleteFromMinio(filePath);
          }
        }, undefined, 'Failed to cleanup files after database error');
      }
      
      throw dbError; // Re-throw to be handled by outer catch
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
      let notificationLink = `/manager/approvals/${leaveRequest.id}`;
      if (approverUser) {
        if (approverUser.role === 'HR' || 
            (approverUser.role === 'EMPLOYEE' && approverUser.department?.toLowerCase().includes('hr'))) {
          notificationLink = `/hr?request=${leaveRequest.id}`;
        } else if (approverUser.role === 'EXECUTIVE') {
          notificationLink = `/executive?request=${leaveRequest.id}`;
        }
      }
      
      await prisma.notification.create({
        data: {
          userId: firstApprover.approverId,
          type: 'APPROVAL_REQUIRED',
          title: 'Leave Request Approval Required',
          message: `${user.firstName} ${user.lastName} has requested ${actualDays} days of leave`,
          link: notificationLink,
        },
      });
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
        requestNumber,
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
              type: 'SICK_LEAVE_SUBMITTED',
              title: 'Sick Leave Verification Required',
              message: `${user.firstName} ${user.lastName} has submitted sick leave with medical documents`,
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
            reason: `Medical leave with ${uploadedDocumentUrls.length} document(s) for verification`,
            managerName: `${hrUser.firstName} ${hrUser.lastName}`,
            companyName: process.env.COMPANY_NAME || 'TPF',
            requestId: leaveRequest.id
          });
          
          log.info('Sick leave email sent to HR', { 
            to: hrUser.email,
            requestNumber 
          });
        }, undefined, `Failed to send sick leave email to ${hrUser.email}`);
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
      
      if (leaveType?.documentTemplates.length > 0) {
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

// Helper function to get substitute names
async function getSubstituteNames(substituteIds: string[]): Promise<string> {
  const substitutes = await prisma.user.findMany({
    where: {
      id: { in: substituteIds },
    },
    select: {
      firstName: true,
      lastName: true,
    },
  });
  
  return substitutes.map(s => `${s.firstName} ${s.lastName}`).join(', ');
}

// Helper function to generate approval workflow based on rules
async function generateApprovalWorkflow(user: any, leaveTypeId: string, days: number) {
  console.log('[generateApprovalWorkflow] Starting for user:', {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    role: user.role,
    managerId: user.managerId || user.manager?.id,
    departmentDirectorId: user.departmentDirectorId || user.departmentDirector?.id
  });
  
  // Get leave type information for workflow rules
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    select: { code: true, requiresHRVerification: true }
  });
  
  console.log('[generateApprovalWorkflow] Leave type info:', leaveType);
  
  // Determine approval requirements based on user role
  let approvalLevels = [];
  
  switch (user.role) {
    case 'EMPLOYEE':
      // Regular employees need manager approval
      approvalLevels = [{ role: 'DIRECT_MANAGER', required: true }];
      break;
      
    case 'MANAGER':
      // Managers need their own manager's approval
      // If their manager is an executive, only one approval is needed
      const managerApprovals = [];
      
      // Check if the manager's direct manager is an executive
      const managerId = user.managerId || user.manager?.id;
      if (managerId) {
        const directManager = await prisma.user.findUnique({
          where: { id: managerId },
          select: { role: true }
        });
        
        if (directManager?.role === 'EXECUTIVE') {
          // If reporting to an executive, only need that executive's approval
          // No additional levels needed when manager is already an executive
          managerApprovals.push({ role: 'DIRECT_MANAGER', required: true });
        } else {
          // Otherwise, need manager approval and potentially department director
          managerApprovals.push({ role: 'DIRECT_MANAGER', required: true });
          
          // Add department director if different from direct manager
          const deptDirectorId = user.departmentDirectorId || user.departmentDirector?.id;
          if (deptDirectorId && deptDirectorId !== managerId) {
            managerApprovals.push({ role: 'DEPARTMENT_HEAD', required: true });
          }
        }
      } else if (user.departmentDirectorId || user.departmentDirector?.id) {
        // No direct manager but has department director
        managerApprovals.push({ role: 'DEPARTMENT_HEAD', required: true });
      } else {
        // No manager or director set, try to find an executive
        managerApprovals.push({ role: 'EXECUTIVE', required: true });
      }
      
      approvalLevels = managerApprovals;
      break;
      
    case 'DEPARTMENT_DIRECTOR':
      // Directors need executive approval
      approvalLevels = [{ role: 'EXECUTIVE', required: true }];
      break;
      
    case 'EXECUTIVE':
      // Executives need another executive's approval
      approvalLevels = [{ role: 'ANOTHER_EXECUTIVE', required: true }];
      break;
      
    default:
      // Default to manager approval
      approvalLevels = [{ role: 'DIRECT_MANAGER', required: true }];
  }
  
  // Check if there are workflow rules that override the default
  const rules = await prisma.workflowRule.findMany({
    where: {
      isActive: true,
      OR: [
        { conditions: { path: ['userRole'], array_contains: user.role } },
        { conditions: { path: ['leaveType'], array_contains: leaveType?.code } },
        { conditions: { path: ['department'], array_contains: user.department } },
      ],
    },
    orderBy: {
      priority: 'desc',
    },
  });

  // Find the first matching rule
  let applicableRule = null;
  for (const rule of rules) {
    const conditions = rule.conditions as any;
    
    // Check days condition
    if (conditions.daysGreaterThan && days <= conditions.daysGreaterThan) continue;
    if (conditions.daysLessThan && days >= conditions.daysLessThan) continue;
    
    applicableRule = rule;
    break;
  }

  // Use rule-based workflow if available
  if (applicableRule?.approvalLevels) {
    console.log('[generateApprovalWorkflow] Using workflow rule:', {
      ruleId: applicableRule.id,
      ruleName: applicableRule.name,
      approvalLevels: applicableRule.approvalLevels
    });
    approvalLevels = applicableRule.approvalLevels as any[];
  } else {
    console.log('[generateApprovalWorkflow] Using default approval levels:', approvalLevels);
  }

  // Convert workflow roles to actual approvers
  const approvals = [];
  let level = 1;

  for (const approvalLevel of approvalLevels) {
    let approverId = null;

    switch (approvalLevel.role) {
      case 'DIRECT_MANAGER':
      case 'employee': // Workflow rule uses lowercase
      case 'manager':  // Workflow rule might use this
        approverId = user.managerId || user.manager?.id;
        break;
      case 'DEPARTMENT_HEAD':
      case 'department_director': // Workflow rule uses this
        approverId = user.departmentDirectorId || user.departmentDirector?.id;
        break;
      case 'HR':
      case 'hr_verification':
        // Find an HR user or employee in HR department
        const hrUser = await prisma.user.findFirst({
          where: { 
            OR: [
              { role: 'HR', isActive: true },
              { 
                role: 'EMPLOYEE', 
                isActive: true,
                department: { contains: 'hr', mode: 'insensitive' }
              }
            ]
          },
        });
        approverId = hrUser?.id;
        break;
      case 'EXECUTIVE':
        // Find an executive user (preferably department head or someone senior)
        const execUser = await prisma.user.findFirst({
          where: { 
            role: 'EXECUTIVE', 
            isActive: true,
            id: { not: user.id } // Not the requester themselves
          },
        });
        approverId = execUser?.id;
        break;
      case 'ANOTHER_EXECUTIVE':
        // For executives, find another executive to approve (not themselves)
        // Priority order:
        // 1. Executive's own manager (if they have one and the manager is also an executive)
        // 2. Any other active executive who is NOT on leave
        // 3. Any other active executive (fallback)
        // 4. HR as final fallback if only one executive exists

        let selectedExecutive: { id: string } | null = null;

        // First, check if the requesting executive has a manager who is also an executive
        const executiveManagerId = user.managerId || user.manager?.id;
        if (executiveManagerId) {
          const executiveManager = await prisma.user.findUnique({
            where: {
              id: executiveManagerId,
              role: 'EXECUTIVE',
              isActive: true
            },
            select: { id: true }
          });
          if (executiveManager) {
            selectedExecutive = executiveManager;
            console.log('[generateApprovalWorkflow] Using executive manager as approver:', executiveManagerId);
          }
        }

        // If no executive manager, find another active executive not on leave
        if (!selectedExecutive) {
          // Check for executives currently on approved leave
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const executivesOnLeave = await prisma.leaveRequest.findMany({
            where: {
              status: 'APPROVED',
              startDate: { lte: today },
              endDate: { gte: today },
              user: { role: 'EXECUTIVE' }
            },
            select: { userId: true }
          });
          const executiveIdsOnLeave = executivesOnLeave.map(lr => lr.userId);

          // Find an executive who is NOT the requester and NOT on leave
          const availableExec = await prisma.user.findFirst({
            where: {
              role: 'EXECUTIVE',
              isActive: true,
              id: {
                not: user.id,
                notIn: executiveIdsOnLeave
              }
            },
            orderBy: { firstName: 'asc' } // Consistent ordering
          });

          if (availableExec) {
            selectedExecutive = availableExec;
            console.log('[generateApprovalWorkflow] Found available executive (not on leave):', availableExec.id);
          }
        }

        // Fallback: any other executive (even if on leave)
        if (!selectedExecutive) {
          const anyOtherExec = await prisma.user.findFirst({
            where: {
              role: 'EXECUTIVE',
              isActive: true,
              id: { not: user.id }
            },
            orderBy: { firstName: 'asc' }
          });

          if (anyOtherExec) {
            selectedExecutive = anyOtherExec;
            console.log('[generateApprovalWorkflow] Using fallback executive (may be on leave):', anyOtherExec.id);
          }
        }

        // Final fallback: if only one executive exists, escalate to HR
        if (!selectedExecutive) {
          console.warn('[generateApprovalWorkflow] Only one executive exists, escalating to HR');
          const hrFallback = await prisma.user.findFirst({
            where: {
              OR: [
                { role: 'HR', isActive: true },
                {
                  role: 'EMPLOYEE',
                  isActive: true,
                  department: { contains: 'hr', mode: 'insensitive' }
                }
              ]
            }
          });
          if (hrFallback) {
            selectedExecutive = hrFallback;
            console.log('[generateApprovalWorkflow] Using HR as fallback for single-executive scenario:', hrFallback.id);
          }
        }

        approverId = selectedExecutive?.id || null;

        // If still no approver found, throw an error rather than silently failing
        if (!approverId && approvalLevel.required) {
          console.error('[generateApprovalWorkflow] Critical: No approver available for executive leave request');
          throw new Error('No peer executive or HR personnel available to approve your leave request. Please contact your administrator.');
        }
        break;
    }

    if (approverId && approvalLevel.required) {
      // Check for duplicate signatures
      const isDuplicate = approvals.some(a => a.approverId === approverId);
      if (!isDuplicate || !applicableRule?.skipDuplicateSignatures) {
        console.log('[generateApprovalWorkflow] Adding approval:', {
          role: approvalLevel.role,
          approverId,
          level
        });
        approvals.push({
          approverId,
          level: level++,
          status: 'PENDING',
        });
      }
    } else {
      console.warn('[generateApprovalWorkflow] No approver found for role:', {
        role: approvalLevel.role,
        required: approvalLevel.required,
        approverId
      });
    }
  }

  // Critical check: For sick leave requiring HR verification, ensure HR approver exists
  if (leaveType?.code === 'SL' && leaveType?.requiresHRVerification) {
    const hasHRApproval = approvals.some(approval => 
      approval.approverId // Has valid approver ID
    );
    
    if (!hasHRApproval) {
      console.error('[generateApprovalWorkflow] Critical: No HR approver available for sick leave verification');
      throw new Error('No HR personnel available for sick leave verification. Please contact your administrator.');
    }
  }

  console.log('[generateApprovalWorkflow] Final approvals:', approvals);
  return approvals;
}