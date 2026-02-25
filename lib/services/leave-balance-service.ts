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
      maxCarryForwardDays: 5, // Default 5 days; overridden by LeaveType.maxCarryForward when available
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
      let entitledDays = leaveType.daysAllowed || 0;

      // Apply pro-rating if enabled and user joined mid-year
      if (this.config.proRateEnabled && joiningDate.getFullYear() === currentYear) {
        entitledDays = await this.calculateProRatedBalance(
          userId,
          joiningDate,
          leaveType.id,
          entitledDays
        );
      }

      // Use upsert to avoid race conditions from concurrent requests
      const balance = await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId: leaveType.id,
            year: currentYear
          }
        },
        update: {}, // Don't overwrite if already exists
        create: {
          userId,
          leaveTypeId: leaveType.id,
          year: currentYear,
          entitled: entitledDays,
          available: entitledDays,
          used: 0,
          pending: 0,
          carriedForward: 0
        }
      });

      // Only log if this was a new creation (createdAt equals updatedAt approximately)
      const isNew = Math.abs(balance.createdAt.getTime() - balance.updatedAt.getTime()) < 1000;
      if (isNew) {
        await prisma.auditLog.create({
          data: {
            userId: 'SYSTEM',
            action: 'BALANCE_INITIALIZED',
            entity: 'LEAVE_BALANCE',
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
          entity: 'LEAVE_BALANCE',
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
      if (this.config.carryForwardEnabled && balance.leaveType.carryForward) {
        // Calculate unused balance that can be carried forward
        const unusedBalance = Math.max(0, balance.entitled + balance.carriedForward - balance.used);

        // Use leave type's maxCarryForward if set, otherwise fall back to global config
        // 0 means unlimited
        const maxCF = balance.leaveType.maxCarryForward ?? this.config.maxCarryForwardDays;

        // Apply maximum carry forward limit (0 = unlimited)
        carryForwardAmount = maxCF > 0 ? Math.min(unusedBalance, maxCF) : unusedBalance;
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
            available: nextYearBalance.entitled + carryForwardAmount - nextYearBalance.used - nextYearBalance.pending
          }
        });
      } else {
        // Create new balance for next year
        await prisma.leaveBalance.create({
          data: {
            userId,
            leaveTypeId: balance.leaveTypeId,
            year: nextYear,
            entitled: balance.leaveType.daysAllowed || 0,
            available: (balance.leaveType.daysAllowed || 0) + carryForwardAmount,
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
            entity: 'LEAVE_BALANCE',
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
      // Only expire unused portion of carry forward (FIFO: used CF days are already consumed)
      const unusedCF = balance.carriedForward - balance.carriedForwardUsed;
      const newAvailable = Math.max(0, balance.entitled - balance.used - balance.pending);

      await prisma.leaveBalance.update({
        where: {
          id: balance.id
        },
        data: {
          available: newAvailable,
          carriedForward: 0,
          carriedForwardUsed: 0
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: 'SYSTEM',
          action: 'CARRY_FORWARD_EXPIRED',
          entity: 'LEAVE_BALANCE',
          entityType: 'LEAVE_BALANCE',
          entityId: balance.userId,
          details: {
            year: currentYear,
            expiredDays: unusedCF,
            totalCarriedForward: balance.carriedForward,
            usedCarriedForward: balance.carriedForwardUsed,
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
      const newUsed = balance.used + days;
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: newUsed,
          available: balance.entitled + balance.carriedForward - newUsed - balance.pending
        }
      });
    } else {
      const newUsed = Math.max(0, balance.used - days);
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: newUsed,
          available: balance.entitled + balance.carriedForward - newUsed - balance.pending
        }
      });
    }
  }
}