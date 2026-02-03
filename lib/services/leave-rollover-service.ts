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

      // Calculate unused days
      const unused = Math.max(0, balance.entitled + balance.carriedForward - balance.used)
      
      // Calculate how much can be carried forward
      const carryForwardPercentage = config.carryForwardPercentage || 100
      const eligibleForCarryForward = (unused * carryForwardPercentage) / 100
      const carriedForward = Math.min(eligibleForCarryForward, config.maxCarryForward)
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
          available: leaveType.daysAllowed + carriedForward,
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
      maxCarryForward: leaveType.maxCarryForward || 5, // Default 5 days if not specified
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
    const toYear = fromYear + 1
    
    // Check if there are any balances with carried forward amounts for the target year
    const count = await prisma.leaveBalance.count({
      where: {
        year: toYear,
        carriedForward: { gt: 0 }
      }
    })

    return count > 0
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