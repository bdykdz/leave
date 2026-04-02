import { prisma } from '@/lib/prisma'
import { AuditService } from './audit-service'

export interface RolloverConfig {
  leaveTypeId: string
  maxCarryForward: number // Maximum days that can be carried forward
  carryForwardPercentage?: number // Percentage of unused days to carry forward (default 100%)
  expiryDate?: Date // When carried forward days expire (default: end of next year)
  requiresApproval?: boolean // Whether rollover requires manager approval
}

export interface RolloverResult {
  userId: string
  leaveTypeId: string
  year: number
  entitled: number
  used: number
  unused: number
  carriedForward: number
  lost: number
  reason: string
}

export class LeaveRolloverService {
  /**
   * Calculate rollover for all users for a specific year
   */
  static async calculateYearEndRollover(fromYear: number, toYear: number = fromYear + 1): Promise<RolloverResult[]> {
    // Get all leave balances for the ending year
    const balances = await prisma.leaveBalance.findMany({
      where: { year: fromYear },
      include: {
        leaveType: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            isActive: true
          }
        }
      }
    })

    const rolloverResults: RolloverResult[] = []

    for (const balance of balances) {
      // Skip inactive users
      if (!balance.user.isActive) continue

      // Get rollover configuration for this leave type
      const config = this.getRolloverConfig(balance.leaveType)
      if (!config) continue

      // Calculate unused days (pending requests are reserved and not available for carry-forward)
      const unused = Math.max(0, balance.entitled + balance.carriedForward - balance.used - balance.pending)
      
      // Calculate how much can be carried forward
      const carryForwardPercentage = config.carryForwardPercentage || 100
      const eligibleForCarryForward = (unused * carryForwardPercentage) / 100
      // 0 = unlimited carry forward
      const carriedForward = config.maxCarryForward > 0 ? Math.min(eligibleForCarryForward, config.maxCarryForward) : eligibleForCarryForward
      const lost = unused - carriedForward

      let reason = ''
      if (lost > 0) {
        if (eligibleForCarryForward > config.maxCarryForward) {
          reason = `Exceeded maximum carry forward limit of ${config.maxCarryForward} days`
        } else if (carryForwardPercentage < 100) {
          reason = `Only ${carryForwardPercentage}% of unused days can be carried forward`
        }
      } else {
        reason = 'Full unused balance carried forward'
      }

      rolloverResults.push({
        userId: balance.userId,
        leaveTypeId: balance.leaveTypeId,
        year: fromYear,
        entitled: balance.entitled,
        used: balance.used,
        unused,
        carriedForward,
        lost,
        reason
      })
    }

    return rolloverResults
  }

  /**
   * Execute rollover for a specific user and leave type
   */
  static async executeRollover(
    userId: string, 
    leaveTypeId: string, 
    fromYear: number, 
    carriedForward: number,
    auditUserId?: string
  ): Promise<boolean> {
    try {
      const toYear = fromYear + 1

      // Get the user's leave type allocation for the new year
      const leaveType = await prisma.leaveType.findUnique({
        where: { id: leaveTypeId }
      })

      if (!leaveType) {
        throw new Error('Leave type not found')
      }

      // Get existing balance to preserve used/pending
      const existingNext = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: { userId, leaveTypeId, year: toYear }
        }
      })
      const nextUsed = existingNext?.used || 0
      const nextPending = existingNext?.pending || 0
      const nextEntitled = existingNext?.entitled || leaveType.daysAllowed

      // Create or update the new year's balance
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId,
            year: toYear
          }
        },
        update: {
          carriedForward,
          available: nextEntitled + carriedForward - nextUsed - nextPending,
          updatedAt: new Date()
        },
        create: {
          userId,
          leaveTypeId,
          year: toYear,
          entitled: leaveType.daysAllowed,
          carriedForward,
          available: leaveType.daysAllowed + carriedForward,
          used: 0,
          pending: 0
        }
      })

      // Log the rollover action
      await AuditService.log({
        action: 'UPDATE',
        entityType: 'LeaveBalance',
        entityId: `${userId}-${leaveTypeId}-${toYear}`,
        userId: auditUserId || 'SYSTEM',
        details: {
          actionType: 'ROLLOVER',
          fromYear,
          toYear,
          carriedForward,
          leaveType: leaveType.name
        }
      })

      return true
    } catch (error) {
      console.error('Error executing rollover:', error)
      return false
    }
  }

  /**
   * Execute bulk rollover for all eligible users
   */
  static async executeBulkRollover(fromYear: number, auditUserId?: string): Promise<{
    successful: number,
    failed: number,
    results: RolloverResult[]
  }> {
    const rolloverResults = await this.calculateYearEndRollover(fromYear)
    let successful = 0
    let failed = 0

    for (const result of rolloverResults) {
      const success = await this.executeRollover(
        result.userId,
        result.leaveTypeId,
        fromYear,
        result.carriedForward,
        auditUserId
      )

      if (success) {
        successful++
      } else {
        failed++
      }
    }

    // Log the bulk rollover action
    await AuditService.log({
      action: 'UPDATE',
      entityType: 'LeaveBalance',
      userId: auditUserId || 'SYSTEM',
      details: {
        actionType: 'BULK_ROLLOVER',
        fromYear,
        toYear: fromYear + 1,
        totalProcessed: rolloverResults.length,
        successful,
        failed
      }
    })

    return {
      successful,
      failed,
      results: rolloverResults
    }
  }

  /**
   * Get rollover configuration for a leave type
   */
  private static getRolloverConfig(leaveType: any): RolloverConfig | null {
    // If leave type doesn't allow carry forward, return null
    if (!leaveType.carryForward) {
      return null
    }

    // Use the maxCarryForward from the leave type, or default rules
    return {
      leaveTypeId: leaveType.id,
      maxCarryForward: leaveType.maxCarryForward ?? 0, // 0 = unlimited
      carryForwardPercentage: 100, // Can be customized per leave type
      requiresApproval: false // Can be customized per leave type
    }
  }

  /**
   * Get rollover preview for a specific year
   */
  static async getRolloverPreview(fromYear: number): Promise<{
    summary: {
      totalUsers: number,
      totalDaysCarriedForward: number,
      totalDaysLost: number,
      avgCarryForward: number
    },
    details: RolloverResult[]
  }> {
    const results = await this.calculateYearEndRollover(fromYear)

    const totalDaysCarriedForward = results.reduce((sum, r) => sum + r.carriedForward, 0)
    const totalDaysLost = results.reduce((sum, r) => sum + r.lost, 0)
    const avgCarryForward = results.length > 0 ? totalDaysCarriedForward / results.length : 0

    return {
      summary: {
        totalUsers: results.length,
        totalDaysCarriedForward,
        totalDaysLost,
        avgCarryForward: Math.round(avgCarryForward * 100) / 100
      },
      details: results
    }
  }

  /**
   * Check if rollover has already been executed for a year
   */
  static async isRolloverExecuted(fromYear: number): Promise<boolean> {
    // Check audit log for a completed rollover action for this year
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        action: 'UPDATE',
        entityType: 'LeaveBalance',
        details: {
          path: ['actionType'],
          equals: 'BULK_ROLLOVER'
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (auditEntry) {
      const details = auditEntry.details as any
      if (details?.fromYear === fromYear) {
        return true
      }
    }

    // Also check for chain rollover
    const chainEntry = await prisma.auditLog.findFirst({
      where: {
        action: 'UPDATE',
        entityType: 'LeaveBalance',
        details: {
          path: ['actionType'],
          equals: 'CHAIN_ROLLOVER'
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (chainEntry) {
      const details = chainEntry.details as any
      if (details?.startYear <= fromYear && details?.endYear >= fromYear) {
        return true
      }
    }

    return false
  }

  /**
   * Execute chain rollover across multiple years (e.g., 2023→2024→2025→2026)
   * Processes each user's NL balances sequentially, computing carry-forward from year N to N+1
   */
  static async executeChainRollover(
    startYear: number,
    endYear: number,
    auditUserId: string,
    dryRun: boolean = false
  ): Promise<{
    summary: { totalUsers: number; totalCarriedForward: number; totalLost: number };
    users: Array<{
      userId: string;
      employeeId: string;
      name: string;
      years: Array<{
        year: number;
        entitled: number;
        used: number;
        carriedForward: number;
        available: number;
        unused: number;
        carryToNext: number;
        lost: number;
      }>;
    }>;
  }> {
    // Find NL leave type (only type with carry-forward)
    const nlLeaveType = await prisma.leaveType.findFirst({
      where: { code: 'NL', carryForward: true }
    })

    if (!nlLeaveType) {
      throw new Error('Normal Leave (NL) leave type with carryForward=true not found')
    }

    const maxCarry = nlLeaveType.maxCarryForward || 5

    // Fetch all NL balances across the year range
    const balances = await prisma.leaveBalance.findMany({
      where: {
        leaveTypeId: nlLeaveType.id,
        year: { gte: startYear, lte: endYear }
      },
      include: {
        user: {
          select: { id: true, employeeId: true, firstName: true, lastName: true, isActive: true }
        }
      },
      orderBy: { year: 'asc' }
    })

    // Group by user
    const userBalances = new Map<string, typeof balances>()
    for (const b of balances) {
      if (!b.user.isActive) continue
      const existing = userBalances.get(b.userId) || []
      existing.push(b)
      userBalances.set(b.userId, existing)
    }

    const userResults: Array<{
      userId: string;
      employeeId: string;
      name: string;
      years: Array<{
        year: number;
        entitled: number;
        used: number;
        carriedForward: number;
        available: number;
        unused: number;
        carryToNext: number;
        lost: number;
      }>;
    }> = []

    let totalCarriedForward = 0
    let totalLost = 0

    for (const [userId, bals] of userBalances) {
      const sortedBals = bals.sort((a, b) => a.year - b.year)
      const user = sortedBals[0].user
      const yearResults: typeof userResults[0]['years'] = []

      let prevCarry = 0

      for (let year = startYear; year <= endYear; year++) {
        const bal = sortedBals.find(b => b.year === year)
        if (!bal) {
          prevCarry = 0  // Can't carry through a year with no balance record
          continue
        }

        // For the first year in the chain, carriedForward stays as-is (0 for imported historical)
        // For subsequent years, update carriedForward from previous year's surplus
        const carriedForward = year === startYear ? bal.carriedForward : prevCarry
        const entitled = bal.entitled
        const used = bal.used
        const available = entitled + carriedForward - used - bal.pending
        const unused = Math.max(0, available)
        // 0 = unlimited carry forward
        const carryToNext = maxCarry > 0 ? Math.min(unused, maxCarry) : unused
        const lost = unused - carryToNext

        yearResults.push({
          year,
          entitled,
          used,
          carriedForward,
          available,
          unused,
          carryToNext,
          lost
        })

        prevCarry = carryToNext
        totalCarriedForward += carryToNext
        totalLost += lost
      }

      // Persist all changes for this user in a single transaction
      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          // Update intermediate years' balances with computed carriedForward
          for (const yr of yearResults) {
            if (yr.year === startYear || yr.year > endYear) continue
            const bal = sortedBals.find(b => b.year === yr.year)
            if (!bal) continue
            await tx.leaveBalance.update({
              where: { id: bal.id },
              data: {
                carriedForward: yr.carriedForward,
                available: yr.entitled + yr.carriedForward - yr.used - bal.pending,
                updatedAt: new Date()
              }
            })
          }

          // Handle the final carry into endYear+1 (e.g., 2025→2026)
          if (prevCarry > 0) {
            const nextYear = endYear + 1
            // Fetch existing balance to preserve used/pending
            const existingNext = await tx.leaveBalance.findUnique({
              where: {
                userId_leaveTypeId_year: { userId, leaveTypeId: nlLeaveType.id, year: nextYear }
              }
            })
            const nextUsed = existingNext?.used || 0
            const nextPending = existingNext?.pending || 0
            const nextEntitled = existingNext?.entitled || nlLeaveType.daysAllowed

            await tx.leaveBalance.upsert({
              where: {
                userId_leaveTypeId_year: { userId, leaveTypeId: nlLeaveType.id, year: nextYear }
              },
              update: {
                carriedForward: prevCarry,
                available: nextEntitled + prevCarry - nextUsed - nextPending,
                updatedAt: new Date()
              },
              create: {
                userId,
                leaveTypeId: nlLeaveType.id,
                year: nextYear,
                entitled: nlLeaveType.daysAllowed,
                used: 0,
                pending: 0,
                carriedForward: prevCarry,
                available: nlLeaveType.daysAllowed + prevCarry,
              }
            })
          }
        })
      }

      // Handle the final carry into endYear+1 for preview/results
      if (prevCarry > 0) {
        const nextYear = endYear + 1
        const nextBal = await prisma.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: { userId, leaveTypeId: nlLeaveType.id, year: nextYear }
          }
        })

        yearResults.push({
          year: nextYear,
          entitled: nextBal?.entitled || nlLeaveType.daysAllowed,
          used: nextBal?.used || 0,
          carriedForward: prevCarry,
          available: (nextBal?.entitled || nlLeaveType.daysAllowed) + prevCarry - (nextBal?.used || 0),
          unused: 0,
          carryToNext: 0,
          lost: 0
        })
      }

      userResults.push({
        userId,
        employeeId: user.employeeId,
        name: `${user.firstName} ${user.lastName}`,
        years: yearResults
      })
    }

    if (!dryRun) {
      await AuditService.log({
        action: 'UPDATE',
        entityType: 'LeaveBalance',
        userId: auditUserId,
        details: {
          actionType: 'CHAIN_ROLLOVER',
          startYear,
          endYear,
          targetYear: endYear + 1,
          totalUsers: userResults.length,
          totalCarriedForward,
          totalLost,
          maxCarryForward: maxCarry
        }
      })
    }

    return {
      summary: {
        totalUsers: userResults.length,
        totalCarriedForward,
        totalLost
      },
      users: userResults
    }
  }

  /**
   * Get user's rollover history
   */
  static async getUserRolloverHistory(userId: string, years: number = 3): Promise<any[]> {
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - years

    const balances = await prisma.leaveBalance.findMany({
      where: {
        userId,
        year: { gte: startYear },
        carriedForward: { gt: 0 }
      },
      include: {
        leaveType: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { leaveType: { name: 'asc' } }
      ]
    })

    return balances.map(balance => ({
      year: balance.year,
      leaveType: balance.leaveType.name,
      leaveTypeCode: balance.leaveType.code,
      entitled: balance.entitled,
      carriedForward: balance.carriedForward,
      totalAvailable: balance.entitled + balance.carriedForward,
      used: balance.used,
      remaining: balance.available
    }))
  }
}