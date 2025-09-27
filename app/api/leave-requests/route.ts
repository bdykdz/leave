import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { SmartDocumentGenerator } from '@/lib/smart-document-generator';

const prisma = new PrismaClient();
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
export async function GET(request: NextRequest) {
  try {
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

    console.log('Fetching leave requests for user:', session.user.id);
    console.log('Query where clause:', JSON.stringify(where, null, 2));

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

    console.log('Found leave requests:', leaveRequests.length);

    return NextResponse.json({ leaveRequests });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave requests' },
      { status: 500 }
    );
  }
}

// POST /api/leave-requests - Create a new leave request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate request body
    const validatedData = createLeaveRequestSchema.parse(body);
    
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

    // If specific dates are selected (non-consecutive), use that count instead
    const actualDays = validatedData.selectedDates?.length || totalDays;

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: session.user.id,
          leaveTypeId: validatedData.leaveTypeId,
          year: currentYear,
        },
      },
    });

    if (!leaveBalance || leaveBalance.available < actualDays) {
      return NextResponse.json(
        { error: 'Insufficient leave balance' },
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
        // Store selected dates and formatted dates
        supportingDocuments: {
          selectedDates: validatedData.selectedDates || null,
          formattedDates: formattedDates,
          substituteNames: validatedData.substituteIds ? 
            await getSubstituteNames(validatedData.substituteIds) : null,
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

    // Automatically generate document for the leave request
    try {
      console.log(`Generating document for leave request ${leaveRequest.id}`);
      
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
        console.log(`Document generated successfully: ${documentId}`);
        
        // Add employee signature if provided
        if (signature) {
          await documentGenerator.addSignature(
            documentId,
            session.user.id,
            'employee',
            signature
          );
          console.log('Employee signature added to document');
        }
      } else {
        console.log('No active template found for leave type:', leaveType?.name);
      }
    } catch (docError) {
      console.error('Error generating document:', docError);
      // Don't fail the request if document generation fails
      // Document can be generated later manually
    }

    return NextResponse.json({
      success: true,
      leaveRequest,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error creating leave request:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { error: 'Failed to create leave request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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
  // Determine approval requirements based on user role
  let approvalLevels = [];
  
  switch (user.role) {
    case 'EMPLOYEE':
      // Regular employees need manager approval
      approvalLevels = [{ role: 'DIRECT_MANAGER', required: true }];
      break;
      
    case 'MANAGER':
      // Managers need department director approval (skip their own level)
      approvalLevels = [{ role: 'DEPARTMENT_HEAD', required: true }];
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
    approvalLevels = applicableRule.approvalLevels as any[];
  }

  // Convert workflow roles to actual approvers
  const approvals = [];
  let level = 1;

  for (const approvalLevel of approvalLevels) {
    let approverId = null;

    switch (approvalLevel.role) {
      case 'DIRECT_MANAGER':
        approverId = user.managerId;
        break;
      case 'DEPARTMENT_HEAD':
        approverId = user.departmentDirectorId;
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
        approvals.push({
          approverId,
          level: level++,
          status: 'PENDING',
        });
      }
    }
  }

  return approvals;
}