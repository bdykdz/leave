import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface WorkflowCondition {
  userRole?: string[];
  leaveType?: string[];
  isSpecialLeave?: boolean;
  department?: string[];
  position?: string[];
}

export interface ApprovalLevel {
  role: string;
  required: boolean;
  autoApprove?: boolean;
  conditions?: WorkflowCondition;
}

export interface WorkflowDecision {
  role: string;
  approved: boolean;
  decidedBy: string;
  decidedAt: Date;
  comments?: string;
}

export class WorkflowEngine {
  /**
   * Determine which workflow rule applies to a leave request
   */
  async determineWorkflowRule(leaveRequest: any): Promise<any> {
    // Get all active workflow rules
    const rules = await prisma.workflowRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' }, // Higher priority first
    });

    const user = leaveRequest.user;
    const leaveType = leaveRequest.leaveType;

    // Find the first matching rule
    for (const rule of rules) {
      const conditions = rule.conditions as WorkflowCondition;
      
      if (this.matchesConditions(conditions, {
        userRole: user.role,
        leaveType: leaveType.code,
        isSpecialLeave: leaveType.isSpecialLeave,
        department: user.department,
        position: user.position,
      })) {
        return rule;
      }
    }

    // Return default rule if no match
    return this.getDefaultRule(user.role);
  }

  /**
   * Check if conditions match
   */
  private matchesConditions(conditions: WorkflowCondition, context: any): boolean {
    // Check user role
    if (conditions.userRole && !conditions.userRole.includes(context.userRole)) {
      return false;
    }

    // Check leave type
    if (conditions.leaveType && !conditions.leaveType.includes(context.leaveType)) {
      return false;
    }

    // Check if special leave
    if (conditions.isSpecialLeave !== undefined && context.isSpecialLeave !== conditions.isSpecialLeave) {
      return false;
    }

    // Check department
    if (conditions.department && !conditions.department.includes(context.department)) {
      return false;
    }

    // Check position
    if (conditions.position && !conditions.position.includes(context.position)) {
      return false;
    }

    return true;
  }

  /**
   * Get default workflow rule based on user role
   */
  private getDefaultRule(userRole: string): any {
    const defaultRules: Record<string, ApprovalLevel[]> = {
      EMPLOYEE: [
        { role: 'employee', required: true },
        { role: 'manager', required: true },
      ],
      MANAGER: [
        { role: 'employee', required: true },
        { role: 'department_director', required: true },
      ],
      DEPARTMENT_DIRECTOR: [
        { role: 'employee', required: true },
        { role: 'executive', required: false },
      ],
      EXECUTIVE: [
        { role: 'employee', required: true },
      ],
      HR: [
        { role: 'employee', required: true },
        { role: 'hr_manager', required: true },
      ],
      ADMIN: [
        { role: 'employee', required: true },
      ],
    };

    return {
      name: 'Default Rule',
      approvalLevels: defaultRules[userRole] || defaultRules.EMPLOYEE,
      skipDuplicateSignatures: true,
    };
  }

  /**
   * Get required signers based on workflow rule
   */
  async getRequiredSigners(leaveRequest: any, workflowRule: any): Promise<Map<string, string>> {
    const signers = new Map<string, string>(); // role -> userId
    const user = leaveRequest.user;
    const approvalLevels = workflowRule.approvalLevels as ApprovalLevel[];

    for (const level of approvalLevels) {
      if (!level.required) continue;

      switch (level.role) {
        case 'employee':
          signers.set('employee', user.id);
          break;

        case 'manager':
          if (user.managerId && user.managerId !== user.id) {
            signers.set('manager', user.managerId);
          } else if (user.role === 'EXECUTIVE') {
            // Executive self-approves as manager
            signers.set('manager', user.id);
          }
          break;

        case 'department_director':
          if (user.departmentDirectorId && user.departmentDirectorId !== user.id) {
            signers.set('department_director', user.departmentDirectorId);
          } else if (user.role === 'EXECUTIVE' || user.role === 'DEPARTMENT_DIRECTOR') {
            // Self-approve as department director
            if (!workflowRule.skipDuplicateSignatures || !signers.has('manager') || signers.get('manager') !== user.id) {
              signers.set('department_director', user.id);
            }
          }
          break;

        case 'hr':
        case 'hr_verification':
          // HR signer will be determined when HR processes
          signers.set(level.role, 'pending');
          break;

        case 'executive':
          // Executive approval for special cases
          const executives = await prisma.user.findMany({
            where: { role: 'EXECUTIVE', isActive: true },
            select: { id: true },
          });
          if (executives.length > 0) {
            signers.set('executive', executives[0].id); // First available executive
          }
          break;
      }
    }

    return signers;
  }

  /**
   * Create predefined workflow rules
   */
  async createDefaultWorkflowRules() {
    const rules = [
      {
        name: 'Special Leave - HR Verification Required',
        description: 'Special leaves requiring HR document verification',
        conditions: {
          isSpecialLeave: true,
        },
        approvalLevels: [
          { role: 'employee', required: true },
          { role: 'hr_verification', required: true }, // Special HR verification step
          { role: 'manager', required: true },
          { role: 'department_director', required: false },
        ],
        priority: 100,
      },
      {
        name: 'Executive Leave Request',
        description: 'Workflow for executive leave requests',
        conditions: {
          userRole: ['EXECUTIVE'],
        },
        approvalLevels: [
          { role: 'employee', required: true },
          // Executives self-approve
        ],
        priority: 90,
      },
      {
        name: 'Department Director Leave',
        description: 'Department directors report to executives',
        conditions: {
          userRole: ['DEPARTMENT_DIRECTOR'],
        },
        approvalLevels: [
          { role: 'employee', required: true },
          { role: 'executive', required: true },
        ],
        priority: 80,
      },
      {
        name: 'Manager Leave',
        description: 'Managers report to department directors',
        conditions: {
          userRole: ['MANAGER'],
        },
        approvalLevels: [
          { role: 'employee', required: true },
          { role: 'department_director', required: true },
        ],
        priority: 70,
      },
      {
        name: 'HR Employee Leave',
        description: 'HR employees follow HR hierarchy',
        conditions: {
          userRole: ['HR'],
        },
        approvalLevels: [
          { role: 'employee', required: true },
          { role: 'hr_manager', required: true },
        ],
        priority: 60,
      },
      {
        name: 'Standard Employee Leave',
        description: 'Default workflow for regular employee leave requests',
        conditions: {
          userRole: ['EMPLOYEE'],
        },
        approvalLevels: [
          { role: 'employee', required: true },
          { role: 'manager', required: true },
        ],
        priority: 10,
      },
    ];

    // Create rules in database
    for (const rule of rules) {
      await prisma.workflowRule.create({
        data: {
          ...rule,
          skipDuplicateSignatures: true,
          isActive: true,
        },
      });
    }
  }

  /**
   * Record a decision (approve/reject)
   */
  async recordDecision(
    documentId: string,
    role: string,
    approved: boolean,
    decidedBy: string,
    comments?: string
  ): Promise<void> {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Get existing decisions and properly convert dates
    const rawDecisions = document.decisions as any[] || [];
    const decisions: WorkflowDecision[] = rawDecisions.map(d => ({
      ...d,
      decidedAt: new Date(d.decidedAt)
    }));

    // Add new decision
    decisions.push({
      role,
      approved,
      decidedBy,
      decidedAt: new Date(),
      comments,
    });

    // Update document with properly serialized decisions
    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: { decisions: decisions as any },
    });

    // Update leave request status if rejected
    if (!approved) {
      await prisma.leaveRequest.update({
        where: { id: document.leaveRequestId },
        data: { status: 'REJECTED' },
      });
    }
  }

  /**
   * Check if all required approvals are complete
   */
  async checkApprovalCompletion(documentId: string): Promise<boolean> {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: documentId },
      include: {
        leaveRequest: {
          include: {
            user: true,
            leaveType: true,
          },
        },
      },
    });

    if (!document) return false;

    const rawDecisions = document.decisions as any[] || [];
    const decisions: WorkflowDecision[] = rawDecisions.map(d => ({
      ...d,
      decidedAt: new Date(d.decidedAt)
    }));
    const templateSnapshot = document.templateSnapshot as any;
    const workflowRule = templateSnapshot.workflowRule;

    // Get required signers
    const requiredSigners = await this.getRequiredSigners(
      document.leaveRequest,
      workflowRule
    );

    // Check if all required approvals are complete and approved
    for (const [role, signerId] of requiredSigners) {
      const decision = decisions.find(d => d.role === role);
      if (!decision || !decision.approved) {
        return false;
      }
    }

    // All approved - update statuses
    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: { 
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    await prisma.leaveRequest.update({
      where: { id: document.leaveRequestId },
      data: { status: 'APPROVED' },
    });

    return true;
  }
}