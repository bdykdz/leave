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

    log.info('Leave requests fetched', { count: leaveRequests.length });

    return NextResponse.json({ leaveRequests });
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
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate actual working days, excluding weekends and holidays
    let actualDays: number;
    
    if (validatedData.selectedDates?.length) {
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

    // Create leave request with approval workflow
    const leaveRequest = await prisma.leaveRequest.create({
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

    // Create notifications for approvers
    const firstApprover = leaveRequest.approvals.find(a => a.level === 1);
    if (firstApprover) {
      await prisma.notification.create({
        data: {
          userId: firstApprover.approverId,
          type: 'APPROVAL_REQUIRED',
          title: 'Leave Request Approval Required',
          message: `${user.firstName} ${user.lastName} has requested ${actualDays} days of leave`,
          link: `/manager/approvals/${leaveRequest.id}`,
        },
      });
    }

    // Send email notification to the first approver
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
          companyName: process.env.COMPANY_NAME || 'Company',
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
        { conditions: { path: ['leaveType'], array_contains: leaveTypeId } },
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
        // Find an HR user
        const hrUser = await prisma.user.findFirst({
          where: { role: 'HR', isActive: true },
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
        // For executives, find another executive (not themselves)
        const anotherExec = await prisma.user.findFirst({
          where: { 
            role: 'EXECUTIVE', 
            isActive: true,
            id: { not: user.id } // Not the requester themselves
          },
        });
        approverId = anotherExec?.id;
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

  console.log('[generateApprovalWorkflow] Final approvals:', approvals);
  return approvals;
}