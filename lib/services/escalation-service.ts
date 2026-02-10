import { PrismaClient } from '@prisma/client';
import { addDays, format } from 'date-fns';
import { emailService } from '@/lib/email-service';

const prisma = new PrismaClient();

export interface EscalationConfig {
  escalationDaysBeforeAutoApproval: number;
  escalationEnabled: boolean;
  requireSignatureForDenial: boolean;
  autoSkipAbsentApprovers: boolean;
  autoApproveAfterMaxEscalations: boolean;
  maxEscalationLevels: number;
  companyTimezone: string;
}

export class EscalationService {
  /**
   * Get current time in company timezone
   */
  private getCompanyTime(timezone: string = 'Europe/Bucharest'): Date {
    try {
      // Create a date in the company timezone
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(now);
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // Month is 0-indexed
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
      
      return new Date(year, month, day, hour, minute, second);
    } catch (error) {
      console.warn(`Invalid timezone ${timezone}, falling back to UTC`);
      return new Date();
    }
  }

  /**
   * Calculate business days between two dates, excluding weekends and holidays
   */
  private async calculateBusinessDays(fromDate: Date, toDate: Date): Promise<number> {
    let businessDays = 0;
    const currentDate = new Date(fromDate);
    
    // Get holidays from database
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate
        },
        isActive: true
      }
    });
    
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
    
    while (currentDate <= toDate) {
      const dayOfWeek = currentDate.getDay();
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Check if it's a weekday (Monday = 1, Friday = 5) and not a holiday
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidayDates.has(dateString)) {
        businessDays++;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return businessDays;
  }

  /**
   * Get the date that is N business days before the given date
   */
  private async getBusinessDaysBefore(fromDate: Date, businessDays: number): Promise<Date> {
    let count = 0;
    const currentDate = new Date(fromDate);
    
    // Get holidays from database for a reasonable range (last 30 days)
    const startRange = new Date(fromDate);
    startRange.setDate(startRange.getDate() - (businessDays * 2)); // Rough estimate for range
    
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startRange,
          lte: fromDate
        },
        isActive: true
      }
    });
    
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
    
    while (count < businessDays) {
      currentDate.setDate(currentDate.getDate() - 1);
      const dayOfWeek = currentDate.getDay();
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Check if it's a weekday and not a holiday
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidayDates.has(dateString)) {
        count++;
      }
    }
    
    return currentDate;
  }

  /**
   * Get escalation configuration from company settings
   */
  async getEscalationConfig(): Promise<EscalationConfig> {
    const settings = await prisma.companySetting.findMany({
      where: {
        key: {
          in: [
            'escalationDaysBeforeAutoApproval', 
            'escalationEnabled', 
            'requireSignatureForDenial',
            'autoSkipAbsentApprovers',
            'autoApproveAfterMaxEscalations',
            'maxEscalationLevels',
            'companyTimezone'
          ]
        }
      }
    });

    // Default values
    const config: EscalationConfig = {
      escalationDaysBeforeAutoApproval: 3,
      escalationEnabled: true,
      requireSignatureForDenial: false,
      autoSkipAbsentApprovers: true,
      autoApproveAfterMaxEscalations: false,
      maxEscalationLevels: 3,
      companyTimezone: 'Europe/Bucharest'
    };

    // Override with database values
    for (const setting of settings) {
      switch(setting.key) {
        case 'escalationDaysBeforeAutoApproval':
          config.escalationDaysBeforeAutoApproval = Number(setting.value);
          break;
        case 'escalationEnabled':
          config.escalationEnabled = setting.value === 'true';
          break;
        case 'requireSignatureForDenial':
          config.requireSignatureForDenial = setting.value === 'true';
          break;
        case 'autoSkipAbsentApprovers':
          config.autoSkipAbsentApprovers = setting.value === 'true';
          break;
        case 'autoApproveAfterMaxEscalations':
          config.autoApproveAfterMaxEscalations = setting.value === 'true';
          break;
        case 'maxEscalationLevels':
          config.maxEscalationLevels = Number(setting.value);
          break;
        case 'companyTimezone':
          config.companyTimezone = setting.value;
          break;
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

    // Calculate escalation threshold using business days in company timezone
    const companyNow = this.getCompanyTime(config.companyTimezone);
    const escalationThreshold = await this.getBusinessDaysBefore(
      companyNow, 
      config.escalationDaysBeforeAutoApproval
    );

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
            },
            leaveType: true
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
   * Check if an approver is absent (on leave or WFH) during the current period
   */
  private async isApproverAbsent(approverId: string, checkDate: Date = new Date()): Promise<boolean> {
    // Check if approver is on leave TODAY (when approval is needed)
    const today = new Date(checkDate);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const onLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId: approverId,
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today }
      }
    });

    if (onLeave) {
      console.log(`Approver ${approverId} is on leave from ${onLeave.startDate} to ${onLeave.endDate}`);
      return true;
    }

    // Optionally check if approver has too many pending approvals (overloaded)
    const pendingCount = await prisma.approval.count({
      where: {
        approverId: approverId,
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    });

    if (pendingCount > 10) {
      console.log(`Approver ${approverId} is overloaded with ${pendingCount} pending approvals`);
      return true;
    }

    return false;
  }

  /**
   * Find a delegate for an absent approver
   */
  private async findDelegate(approverId: string): Promise<string | null> {
    // Check if the approver has set a delegate
    const delegate = await prisma.approvalDelegate.findFirst({
      where: {
        delegatorId: approverId,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        isActive: true
      },
      include: {
        delegate: true
      }
    });

    if (delegate && delegate.delegate.isActive) {
      // Check if the delegate is also absent
      const isDelegateAbsent = await this.isApproverAbsent(delegate.delegateId);
      if (!isDelegateAbsent) {
        console.log(`Found available delegate ${delegate.delegateId} for approver ${approverId}`);
        return delegate.delegateId;
      } else {
        console.log(`Delegate ${delegate.delegateId} is also absent, looking for alternative`);
      }
    }

    // If no delegate, try to find someone at the same level
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { department: true }
    });

    if (approver?.department) {
      // Find other managers in the same department
      const departmentUsers = await prisma.user.findMany({
        where: {
          department: approver.department,
          id: { not: approverId },
          role: { in: ['MANAGER', 'HR', 'EXECUTIVE'] },
          isActive: true
        },
        select: { id: true }
      });

      if (departmentUsers.length > 0) {
        // Return the first available manager in the same department
        return departmentUsers[0].id;
      }
    }

    return null;
  }

  /**
   * Get the next approver in the chain, skipping absent ones
   */
  private async getNextAvailableApprover(
    userId: string,
    currentApproverId: string,
    startDate: Date,
    endDate: Date,
    config: EscalationConfig
  ): Promise<{ approverId: string | null; skippedApprovers: string[] }> {
    const skippedApprovers: string[] = [];
    
    // Get user with full hierarchy
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        manager: true,
        departmentDirector: true
      }
    });

    if (!user) return { approverId: null, skippedApprovers };

    // Build approval chain
    const approvalChain: string[] = [];
    
    if (user.managerId) approvalChain.push(user.managerId);
    if (user.departmentDirectorId && user.departmentDirectorId !== user.managerId) {
      approvalChain.push(user.departmentDirectorId);
    }
    
    // Add HR or Executive as final escalation (excluding people already in chain and the user themselves)
    const excludeIds = [...approvalChain, userId];
    const hrExecutive = await prisma.user.findFirst({
      where: {
        role: { in: ['HR', 'EXECUTIVE'] },
        isActive: true,
        id: { notIn: excludeIds }
      }
    });
    
    if (hrExecutive) approvalChain.push(hrExecutive.id);

    // Find the current approver's position in the chain
    const currentIndex = approvalChain.indexOf(currentApproverId);
    
    // If currentApproverId is 'INITIAL' or not found, start from beginning
    let startIndex = 0;
    if (currentIndex !== -1) {
      startIndex = currentIndex + 1;
    }
    
    // Look for the next available approver
    for (let i = startIndex; i < approvalChain.length; i++) {
      const candidateId = approvalChain[i];
      
      // Check if this approver is available
      if (config.autoSkipAbsentApprovers) {
        const isAbsent = await this.isApproverAbsent(candidateId);
        
        if (isAbsent) {
          // Try to find a delegate
          const delegateId = await this.findDelegate(candidateId);
          
          if (delegateId) {
            console.log(`Using delegate ${delegateId} for absent approver ${candidateId}`);
            return { approverId: delegateId, skippedApprovers };
          }
          
          // No delegate found, skip this approver
          skippedApprovers.push(candidateId);
          console.log(`Skipping absent approver ${candidateId} with no delegate`);
          continue;
        }
      }
      
      // Found an available approver
      return { approverId: candidateId, skippedApprovers };
    }

    // No more approvers in the chain
    return { approverId: null, skippedApprovers };
  }

  /**
   * Escalate a single approval to the next level
   */
  private async escalateApproval(approval: any): Promise<void> {
    const leaveRequest = approval.leaveRequest;
    const currentApprover = approval.approver;
    const config = await this.getEscalationConfig();
    
    // Get the next available approver, skipping absent ones if configured
    const { approverId: escalateToId, skippedApprovers } = await this.getNextAvailableApprover(
      leaveRequest.userId,
      currentApprover.id,
      leaveRequest.startDate,
      leaveRequest.endDate,
      config
    );

    // Build escalation reason
    let escalationReason = `Auto-escalated after ${config.escalationDaysBeforeAutoApproval} days of inactivity`;
    if (skippedApprovers.length > 0) {
      escalationReason += `. Skipped absent approvers: ${skippedApprovers.length}`;
    }
    
    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {

    // Check if we've reached max escalation levels
    if (!escalateToId) {
      if (config.autoApproveAfterMaxEscalations && approval.level >= config.maxEscalationLevels) {
        // Auto-approve the request
        console.log(`Auto-approving request ${leaveRequest.id} after ${approval.level} escalations`);
        
        await tx.leaveRequest.update({
          where: { id: leaveRequest.id },
          data: {
            status: 'APPROVED'
          }
        });

        await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            comments: 'Auto-approved by system after maximum escalations'
          }
        });

        // Create notification for the employee
        await tx.notification.create({
          data: {
            userId: leaveRequest.userId,
            type: 'LEAVE_APPROVED',
            title: 'Leave Request Auto-Approved',
            message: `Your leave request has been automatically approved after reaching maximum escalation levels`,
            link: `/leave/${leaveRequest.id}`
          }
        });

        return;
      }

      console.log(`Cannot escalate approval ${approval.id} - no higher authority found`);
      return;
    }

    // Update the approval with escalation information
    await tx.approval.update({
      where: { id: approval.id },
      data: {
        escalatedToId: escalateToId,
        escalatedAt: new Date(),
        escalationReason
      }
    });

    // Check if an approval record already exists for this approver
    const existingApproval = await tx.approval.findFirst({
      where: {
        leaveRequestId: approval.leaveRequestId,
        approverId: escalateToId,
        status: 'PENDING'
      }
    });

    // Create a new approval record for the escalated approver only if one doesn't exist
    if (!existingApproval) {
      await tx.approval.create({
        data: {
          leaveRequestId: approval.leaveRequestId,
          approverId: escalateToId,
          level: approval.level + 1,
          status: 'PENDING',
          comments: `Escalated from ${currentApprover.firstName} ${currentApprover.lastName}`
        }
      });
    } else {
      console.log(`Approval record already exists for approver ${escalateToId} on request ${approval.leaveRequestId}`);
    }

    // Check if the new approver is HR employee to determine correct link
    const escalatedApprover = await tx.user.findUnique({
      where: { id: escalateToId },
      select: { role: true, department: true }
    });
    
    let notificationLink = `/manager/approvals/${leaveRequest.id}`;
    if (escalatedApprover) {
      if (escalatedApprover.role === 'HR' || 
          (escalatedApprover.role === 'EMPLOYEE' && escalatedApprover.department?.toLowerCase().includes('hr'))) {
        notificationLink = `/hr?request=${leaveRequest.id}`;
      } else if (escalatedApprover.role === 'EXECUTIVE') {
        notificationLink = `/executive?request=${leaveRequest.id}`;
      }
    }
    
    // Create notification for the new approver
    await tx.notification.create({
      data: {
        userId: escalateToId,
        type: 'APPROVAL_REQUIRED',
        title: 'Escalated Leave Request Approval Required',
        message: `Leave request from ${leaveRequest.user.firstName} ${leaveRequest.user.lastName} has been escalated to you for approval`,
        link: notificationLink
      }
    });

    // Create notification for the employee
    await tx.notification.create({
      data: {
        userId: leaveRequest.userId,
        type: 'LEAVE_REQUESTED',
        title: 'Leave Request Escalated',
        message: `Your leave request has been escalated to a higher authority for approval`,
        link: `/leave/${leaveRequest.id}`
      }
    });
    }); // End transaction

    // Send email notification to the escalated-to approver (outside transaction)
    try {
      const escalatedToUser = await prisma.user.findUnique({
        where: { id: escalateToId },
        select: { 
          email: true,
          firstName: true,
          lastName: true
        }
      });

      if (escalatedToUser?.email) {
        await emailService.sendEscalationNotification(escalatedToUser.email, {
          employeeName: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
          leaveType: leaveRequest.leaveType?.name || 'Leave Request',
          startDate: format(new Date(leaveRequest.startDate), 'dd MMMM yyyy'),
          endDate: format(new Date(leaveRequest.endDate), 'dd MMMM yyyy'),
          days: leaveRequest.totalDays,
          escalatedFromName: `${currentApprover.firstName} ${currentApprover.lastName}`,
          escalatedToName: `${escalatedToUser.firstName} ${escalatedToUser.lastName}`,
          escalationReason: escalationReason,
          companyName: process.env.COMPANY_NAME || 'TPF',
          requestId: leaveRequest.id
        });
        
        console.log(`Escalation email sent to ${escalatedToUser.email}`);
      }
    } catch (emailError) {
      console.error('Error sending escalation email:', emailError);
      // Don't fail the escalation if email fails
    }

    console.log(`Successfully escalated approval ${approval.id} to user ${escalateToId}`);
  }

  /**
   * Initialize default escalation settings if they don't exist
   */
  async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = [
      {
        key: 'escalationDaysBeforeAutoApproval',
        value: '3',
        category: 'escalation',
        description: 'Number of days before a pending approval is escalated to the next level'
      },
      {
        key: 'escalationEnabled',
        value: 'true',
        category: 'escalation',
        description: 'Whether automatic escalation is enabled'
      },
      {
        key: 'requireSignatureForDenial',
        value: 'false',
        category: 'approval',
        description: 'Whether denials require a digital signature'
      },
      {
        key: 'autoSkipAbsentApprovers',
        value: 'true',
        category: 'escalation',
        description: 'Automatically skip approvers who are on leave'
      },
      {
        key: 'autoApproveAfterMaxEscalations',
        value: 'false',
        category: 'escalation',
        description: 'Automatically approve requests after maximum escalation levels'
      },
      {
        key: 'maxEscalationLevels',
        value: '3',
        category: 'escalation',
        description: 'Maximum number of escalation levels before auto-approval'
      },
      {
        key: 'companyTimezone',
        value: 'Europe/Bucharest',
        category: 'escalation',
        description: 'Company timezone for escalation calculations'
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

  /**
   * Process new leave requests and set up initial approvals
   */
  async processNewLeaveRequest(leaveRequestId: string): Promise<void> {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: {
        user: {
          include: {
            manager: true,
            departmentDirector: true
          }
        }
      }
    });

    if (!leaveRequest) {
      console.error(`Leave request ${leaveRequestId} not found`);
      return;
    }

    const config = await this.getEscalationConfig();
    
    // Find the first available approver
    let initialApproverId = leaveRequest.user.managerId;
    
    if (initialApproverId && config.autoSkipAbsentApprovers) {
      const isAbsent = await this.isApproverAbsent(initialApproverId);
      
      if (isAbsent) {
        // Find next available approver
        const { approverId, skippedApprovers } = await this.getNextAvailableApprover(
          leaveRequest.userId,
          'INITIAL', // Special case for initial approval
          leaveRequest.startDate,
          leaveRequest.endDate,
          config
        );
        
        if (approverId) {
          initialApproverId = approverId;
          console.log(`Initial approver is absent, using ${approverId} instead. Skipped: ${skippedApprovers.join(', ')}`);
        }
      }
    }

    if (!initialApproverId) {
      console.error(`No approver found for leave request ${leaveRequestId}`);
      return;
    }

    // Create initial approval record
    await prisma.approval.create({
      data: {
        leaveRequestId: leaveRequestId,
        approverId: initialApproverId,
        level: 1,
        status: 'PENDING'
      }
    });

    // Check if initial approver is HR employee to determine correct link
    const initialApprover = await prisma.user.findUnique({
      where: { id: initialApproverId },
      select: { role: true, department: true }
    });
    
    let notificationLink = `/manager/approvals/${leaveRequestId}`;
    if (initialApprover) {
      if (initialApprover.role === 'HR' || 
          (initialApprover.role === 'EMPLOYEE' && initialApprover.department?.toLowerCase().includes('hr'))) {
        notificationLink = `/hr?request=${leaveRequestId}`;
      } else if (initialApprover.role === 'EXECUTIVE') {
        notificationLink = `/executive?request=${leaveRequestId}`;
      }
    }
    
    // Create notification for approver
    await prisma.notification.create({
      data: {
        userId: initialApproverId,
        type: 'APPROVAL_REQUIRED',
        title: 'Leave Request Approval Required',
        message: `New leave request from ${leaveRequest.user.firstName} ${leaveRequest.user.lastName} requires your approval`,
        link: notificationLink
      }
    });
  }
}