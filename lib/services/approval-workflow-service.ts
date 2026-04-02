import { prisma } from '@/lib/prisma'

/**
 * Get substitute names for display purposes
 */
export async function getSubstituteNames(substituteIds: string[]): Promise<string> {
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

/**
 * Generate approval workflow based on user role, leave type, and workflow rules.
 *
 * @param user - The user requesting leave (must include manager and departmentDirector relations)
 * @param leaveTypeId - The leave type ID
 * @param days - Total days requested
 * @returns Array of approval records to create
 */
export async function generateApprovalWorkflow(user: any, leaveTypeId: string, days: number) {
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
      const managerApprovals = [];

      const managerId = user.managerId || user.manager?.id;
      if (managerId) {
        const directManager = await prisma.user.findUnique({
          where: { id: managerId },
          select: { role: true }
        });

        if (directManager?.role === 'EXECUTIVE') {
          managerApprovals.push({ role: 'DIRECT_MANAGER', required: true });
        } else {
          managerApprovals.push({ role: 'DIRECT_MANAGER', required: true });

          const deptDirectorId = user.departmentDirectorId || user.departmentDirector?.id;
          if (deptDirectorId && deptDirectorId !== managerId) {
            managerApprovals.push({ role: 'DEPARTMENT_HEAD', required: true });
          }
        }
      } else if (user.departmentDirectorId || user.departmentDirector?.id) {
        managerApprovals.push({ role: 'DEPARTMENT_HEAD', required: true });
      } else {
        managerApprovals.push({ role: 'EXECUTIVE', required: true });
      }

      approvalLevels = managerApprovals;
      break;

    case 'DEPARTMENT_DIRECTOR':
      approvalLevels = [{ role: 'EXECUTIVE', required: true }];
      break;

    case 'EXECUTIVE':
      approvalLevels = [{ role: 'ANOTHER_EXECUTIVE', required: true }];
      break;

    default:
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

  // If the leave type requires HR verification, ALWAYS inject HR as the FIRST approval step.
  if (leaveType?.requiresHRVerification) {
    const alreadyHasHR = approvalLevels.some(
      (l: any) => l.role === 'HR' || l.role === 'hr_verification'
    );
    if (!alreadyHasHR) {
      approvalLevels = [{ role: 'HR', required: true }, ...approvalLevels];
      console.log('[generateApprovalWorkflow] Prepended HR verification step for requiresHRVerification leave type');
    }
  }

  // Convert workflow roles to actual approvers.
  const approvals = [];
  let level = 1;

  for (const approvalLevel of approvalLevels) {
    let approverId = null;

    switch (approvalLevel.role) {
      case 'DIRECT_MANAGER':
      case 'employee':
      case 'manager':
        approverId = user.managerId || user.manager?.id;
        break;
      case 'DEPARTMENT_HEAD':
      case 'department_director':
        approverId = user.departmentDirectorId || user.departmentDirector?.id;
        break;
      case 'HR':
      case 'hr_verification':
        const hrUser = await prisma.user.findFirst({
          where: {
            id: { not: user.id },
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
        const execUser = await prisma.user.findFirst({
          where: {
            role: 'EXECUTIVE',
            isActive: true,
            id: { not: user.id }
          },
        });
        approverId = execUser?.id;
        break;
      case 'ANOTHER_EXECUTIVE':
        let selectedExecutive: { id: string } | null = null;

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

        if (!selectedExecutive) {
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

          const availableExec = await prisma.user.findFirst({
            where: {
              role: 'EXECUTIVE',
              isActive: true,
              id: {
                not: user.id,
                notIn: executiveIdsOnLeave
              }
            },
            orderBy: { firstName: 'asc' }
          });

          if (availableExec) {
            selectedExecutive = availableExec;
            console.log('[generateApprovalWorkflow] Found available executive (not on leave):', availableExec.id);
          }
        }

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

        if (!approverId && approvalLevel.required) {
          console.error('[generateApprovalWorkflow] Critical: No approver available for executive leave request');
          throw new Error('No peer executive or HR personnel available to approve your leave request. Please contact your administrator.');
        }
        break;
    }

    if (approverId && approvalLevel.required) {
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
          status: 'PENDING' as const,
        });
        const isHRVerificationType = leaveType?.requiresHRVerification;
        const isHRRole = approvalLevel.role === 'HR' || approvalLevel.role === 'hr_verification';
        if (!isHRVerificationType && approvals.length >= 1) {
          console.log('[generateApprovalWorkflow] Stopping after first approval level — escalation service will handle subsequent levels');
          break;
        }
        if (isHRVerificationType && !isHRRole && approvals.length >= 2) {
          console.log('[generateApprovalWorkflow] Stopping after HR + manager approval levels');
          break;
        }
      }
    } else {
      console.warn('[generateApprovalWorkflow] No approver found for role:', {
        role: approvalLevel.role,
        required: approvalLevel.required,
        approverId
      });
    }
  }

  // Critical check: For ALL leave types requiring HR verification, ensure HR approver exists
  if (leaveType?.requiresHRVerification) {
    const hasHRApproval = approvals.some(approval =>
      approval.approverId
    );

    if (!hasHRApproval) {
      console.error('[generateApprovalWorkflow] Critical: No HR approver available for special leave verification', { leaveType: leaveType.code });
      throw new Error(`No HR personnel available for ${leaveType.code === 'SL' ? 'sick leave' : 'special leave'} verification. Please contact your administrator.`);
    }
  }

  console.log('[generateApprovalWorkflow] Final approvals:', approvals);
  return approvals;
}
