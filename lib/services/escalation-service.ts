import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EscalationConfig {
  escalationDaysBeforeAutoApproval: number;
  escalationEnabled: boolean;
  requireSignatureForDenial: boolean;
}

export class EscalationService {
  /**
   * Get escalation configuration from company settings
   */
  async getEscalationConfig(): Promise<EscalationConfig> {
    const settings = await prisma.companySetting.findMany({
      where: {
        key: {
          in: ['escalationDaysBeforeAutoApproval', 'escalationEnabled', 'requireSignatureForDenial']
        }
      }
    });

    // Default values
    const config: EscalationConfig = {
      escalationDaysBeforeAutoApproval: 3,
      escalationEnabled: true,
      requireSignatureForDenial: false
    };

    // Override with database values
    for (const setting of settings) {
      if (setting.key === 'escalationDaysBeforeAutoApproval') {
        config.escalationDaysBeforeAutoApproval = Number(setting.value);
      } else if (setting.key === 'escalationEnabled') {
        config.escalationEnabled = Boolean(setting.value);
      } else if (setting.key === 'requireSignatureForDenial') {
        config.requireSignatureForDenial = Boolean(setting.value);
      }
    }

    return config;
  }

  /**
   * Check and escalate pending approvals
   */
  async checkAndEscalatePendingApprovals(): Promise<void> {
    const config = await this.getEscalationConfig();
    
    if (!config.escalationEnabled) {
      console.log('Escalation is disabled');
      return;
    }

    const escalationThreshold = new Date();
    escalationThreshold.setDate(escalationThreshold.getDate() - config.escalationDaysBeforeAutoApproval);

    // Find all pending approvals that are older than the threshold
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lte: escalationThreshold
        },
        escalatedToId: null // Not already escalated
      },
      include: {
        leaveRequest: {
          include: {
            user: {
              include: {
                manager: true,
                departmentDirector: true
              }
            }
          }
        },
        approver: true
      }
    });

    console.log(`Found ${pendingApprovals.length} approvals to escalate`);

    for (const approval of pendingApprovals) {
      await this.escalateApproval(approval);
    }
  }

  /**
   * Escalate a single approval to the next level
   */
  private async escalateApproval(approval: any): Promise<void> {
    const leaveRequest = approval.leaveRequest;
    const currentApprover = approval.approver;
    
    // Determine who to escalate to
    let escalateToId: string | null = null;
    let escalationReason = `Auto-escalated after ${(await this.getEscalationConfig()).escalationDaysBeforeAutoApproval} days of inactivity`;

    // If current approver is the direct manager, escalate to department director
    if (currentApprover.id === leaveRequest.user.managerId) {
      escalateToId = leaveRequest.user.departmentDirectorId;
    } 
    // If current approver is department director, escalate to executive
    else if (currentApprover.id === leaveRequest.user.departmentDirectorId) {
      const executive = await prisma.user.findFirst({
        where: { 
          role: 'EXECUTIVE', 
          isActive: true 
        }
      });
      escalateToId = executive?.id || null;
    }

    if (!escalateToId) {
      console.log(`Cannot escalate approval ${approval.id} - no higher authority found`);
      return;
    }

    // Update the approval with escalation information
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        escalatedToId,
        escalatedAt: new Date(),
        escalationReason
      }
    });

    // Create a new approval record for the escalated approver
    await prisma.approval.create({
      data: {
        leaveRequestId: approval.leaveRequestId,
        approverId: escalateToId,
        level: approval.level + 1,
        status: 'PENDING',
        comments: `Escalated from ${currentApprover.firstName} ${currentApprover.lastName}`
      }
    });

    // Create notification for the new approver
    await prisma.notification.create({
      data: {
        userId: escalateToId,
        type: 'APPROVAL_REQUIRED',
        title: 'Escalated Leave Request Approval Required',
        message: `Leave request from ${leaveRequest.user.firstName} ${leaveRequest.user.lastName} has been escalated to you for approval`,
        link: `/manager/approvals/${leaveRequest.id}`
      }
    });

    // Create notification for the employee
    await prisma.notification.create({
      data: {
        userId: leaveRequest.userId,
        type: 'LEAVE_REQUESTED',
        title: 'Leave Request Escalated',
        message: `Your leave request has been escalated to a higher authority for approval`,
        link: `/leave/${leaveRequest.id}`
      }
    });

    console.log(`Successfully escalated approval ${approval.id} to user ${escalateToId}`);
  }

  /**
   * Initialize default escalation settings if they don't exist
   */
  async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = [
      {
        key: 'escalationDaysBeforeAutoApproval',
        value: 3,
        category: 'escalation',
        description: 'Number of days before a pending approval is escalated to the next level'
      },
      {
        key: 'escalationEnabled',
        value: true,
        category: 'escalation',
        description: 'Whether automatic escalation is enabled'
      },
      {
        key: 'requireSignatureForDenial',
        value: false,
        category: 'approval',
        description: 'Whether denials require a digital signature'
      }
    ];

    for (const setting of defaultSettings) {
      await prisma.companySetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting
      });
    }
  }
}