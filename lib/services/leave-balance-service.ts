import { prisma } from '@/lib/prisma';
import { addMonths, differenceInDays, startOfYear, endOfYear, format, isAfter } from 'date-fns';

export interface LeaveBalanceConfig {
  carryForwardEnabled: boolean;
  maxCarryForwardDays: number;
  carryForwardExpiryMonths: number; // How many months into new year carry forward is valid
  proRateEnabled: boolean;
  yearEndProcessingDate: Date; // When to run year-end processing
}

export class LeaveBalanceService {
  private static instance: LeaveBalanceService;
  private config: LeaveBalanceConfig;

  private constructor() {
    // Default configuration
    this.config = {
      carryForwardEnabled: true,
      maxCarryForwardDays: 10,
      carryForwardExpiryMonths: 3, // Carry forward expires after 3 months
      proRateEnabled: true,
      yearEndProcessingDate: new Date(`${new Date().getFullYear()}-12-31`)
    };
  }

  static getInstance(): LeaveBalanceService {
    if (!LeaveBalanceService.instance) {
      LeaveBalanceService.instance = new LeaveBalanceService();
    }
    return LeaveBalanceService.instance;
  }

  /**
   * Calculate pro-rated leave balance for new joiners
   */
  async calculateProRatedBalance(
    userId: string,
    joiningDate: Date,
    leaveTypeId: string,
    annualEntitlement: number
  ): Promise<number> {
    const currentYear = new Date().getFullYear();
    const yearStart = startOfYear(new Date(currentYear, 0, 1));
    const yearEnd = endOfYear(new Date(currentYear, 11, 31));
    
    // If joining date is before current year, give full entitlement
    if (joiningDate <= yearStart) {
      return annualEntitlement;
    }

    // Calculate remaining days in the year from joining date
    const totalDaysInYear = differenceInDays(yearEnd, yearStart) + 1;
    const remainingDays = differenceInDays(yearEnd, joiningDate) + 1;
    
    // Pro-rate calculation: (remaining days / total days) * annual entitlement
    const proRatedDays = Math.ceil((remainingDays / totalDaysInYear) * annualEntitlement);
    
    return Math.max(0, proRatedDays);
  }

  /**
   * Initialize leave balances for a new user
   */
  async initializeUserBalances(userId: string, joiningDate: Date): Promise<void> {
    const currentYear = new Date().getFullYear();
    
    // Get all active leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true }
    });

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, department: true }
    });

    for (const leaveType of leaveTypes) {
      let entitledDays = leaveType.defaultDays || 0;

      // Apply pro-rating if enabled and user joined mid-year
      if (this.config.proRateEnabled && joiningDate.getFullYear() === currentYear) {
        entitledDays = await this.calculateProRatedBalance(
          userId,
          joiningDate,
          leaveType.id,
          entitledDays
        );
      }

      // Check if balance already exists
      const existingBalance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId: leaveType.id,
            year: currentYear
          }
        }
      });

      if (!existingBalance) {
        await prisma.leaveBalance.create({
          data: {
            userId,
            leaveTypeId: leaveType.id,
            year: currentYear,
            entitled: entitledDays,
            available: entitledDays,
            used: 0,
            carriedForward: 0
          }
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: 'SYSTEM',
            action: 'BALANCE_INITIALIZED',
            entityType: 'LEAVE_BALANCE',
            entityId: userId,
            details: {
              leaveType: leaveType.name,
              entitledDays,
              proRated: this.config.proRateEnabled && joiningDate.getFullYear() === currentYear,
              joiningDate: format(joiningDate, 'yyyy-MM-dd')
            }
          }
        });
      }
    }
  }

  /**
   * Process year-end carry forward for all users
   */
  async processYearEndCarryForward(): Promise<{
    processed: number;
    errors: string[];
  }> {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const errors: string[] = [];
    let processedCount = 0;

    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: { isActive: true }
      });

      for (const user of users) {
        try {
          await this.processUserYearEndBalance(user.id, currentYear, nextYear);
          processedCount++;
        } catch (error) {
          errors.push(`Failed to process user ${user.email}: ${error}`);
        }
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: 'SYSTEM',
          action: 'YEAR_END_PROCESSING',
          entityType: 'LEAVE_BALANCE',
          entityId: 'ALL',
          details: {
            year: currentYear,
            processedUsers: processedCount,
            errors: errors.length,
            timestamp: new Date()
          }
        }
      });

    } catch (error) {
      console.error('Year-end processing failed:', error);
      throw error;
    }

    return { processed: processedCount, errors };
  }

  /**
   * Process year-end balance for a specific user
   */
  async processUserYearEndBalance(
    userId: string,
    currentYear: number,
    nextYear: number
  ): Promise<void> {
    // Get current year balances
    const currentBalances = await prisma.leaveBalance.findMany({
      where: {
        userId,
        year: currentYear
      },
      include: {
        leaveType: true
      }
    });

    for (const balance of currentBalances) {
      let carryForwardAmount = 0;

      // Calculate carry forward if enabled
      if (this.config.carryForwardEnabled && balance.leaveType.allowCarryForward) {
        // Calculate available balance that can be carried forward
        const availableForCarryForward = balance.available;
        
        // Apply maximum carry forward limit
        carryForwardAmount = Math.min(
          availableForCarryForward,
          this.config.maxCarryForwardDays
        );
      }

      // Check if next year balance already exists
      const nextYearBalance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId: balance.leaveTypeId,
            year: nextYear
          }
        }
      });

      if (nextYearBalance) {
        // Update existing balance
        await prisma.leaveBalance.update({
          where: {
            userId_leaveTypeId_year: {
              userId,
              leaveTypeId: balance.leaveTypeId,
              year: nextYear
            }
          },
          data: {
            carriedForward: carryForwardAmount,
            available: nextYearBalance.entitled + carryForwardAmount
          }
        });
      } else {
        // Create new balance for next year
        await prisma.leaveBalance.create({
          data: {
            userId,
            leaveTypeId: balance.leaveTypeId,
            year: nextYear,
            entitled: balance.leaveType.defaultDays || 0,
            available: (balance.leaveType.defaultDays || 0) + carryForwardAmount,
            used: 0,
            carriedForward: carryForwardAmount
          }
        });
      }

      // Mark carry forward expiry date
      if (carryForwardAmount > 0) {
        const expiryDate = addMonths(
          new Date(nextYear, 0, 1),
          this.config.carryForwardExpiryMonths
        );
        
        // Store expiry information (you might want to add this field to your schema)
        await prisma.auditLog.create({
          data: {
            userId: 'SYSTEM',
            action: 'CARRY_FORWARD_CREATED',
            entityType: 'LEAVE_BALANCE',
            entityId: userId,
            details: {
              leaveType: balance.leaveType.name,
              year: currentYear,
              carryForwardDays: carryForwardAmount,
              expiryDate: format(expiryDate, 'yyyy-MM-dd'),
              maxAllowed: this.config.maxCarryForwardDays
            }
          }
        });
      }
    }
  }

  /**
   * Expire carry forward balances after the configured period
   */
  async expireCarryForwardBalances(): Promise<void> {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Calculate expiry date (e.g., March 31st if expiry is 3 months)
    const expiryDate = addMonths(
      new Date(currentYear, 0, 1),
      this.config.carryForwardExpiryMonths
    );

    // Only process if we've passed the expiry date
    if (!isAfter(currentDate, expiryDate)) {
      return;
    }

    // Find all balances with carry forward for current year
    const balancesWithCarryForward = await prisma.leaveBalance.findMany({
      where: {
        year: currentYear,
        carriedForward: {
          gt: 0
        }
      }
    });

    for (const balance of balancesWithCarryForward) {
      // Deduct expired carry forward from available balance
      const newAvailable = Math.max(0, balance.available - balance.carriedForward);
      
      await prisma.leaveBalance.update({
        where: {
          id: balance.id
        },
        data: {
          available: newAvailable,
          carriedForward: 0
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: 'SYSTEM',
          action: 'CARRY_FORWARD_EXPIRED',
          entityType: 'LEAVE_BALANCE',
          entityId: balance.userId,
          details: {
            year: currentYear,
            expiredDays: balance.carriedForward,
            expiryDate: format(expiryDate, 'yyyy-MM-dd')
          }
        }
      });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LeaveBalanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LeaveBalanceConfig {
    return { ...this.config };
  }

  /**
   * Adjust balance when leave request is approved/cancelled
   */
  async adjustBalance(
    userId: string,
    leaveTypeId: string,
    days: number,
    operation: 'DEDUCT' | 'RESTORE'
  ): Promise<void> {
    const currentYear = new Date().getFullYear();
    
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId,
          year: currentYear
        }
      }
    });

    if (!balance) {
      throw new Error('Leave balance not found');
    }

    if (operation === 'DEDUCT') {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: balance.used + days,
          available: Math.max(0, balance.available - days)
        }
      });
    } else {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: Math.max(0, balance.used - days),
          available: balance.available + days
        }
      });
    }
  }
}