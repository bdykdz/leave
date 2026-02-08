import { prisma } from '@/lib/prisma'
import { WorkingPattern, ContractType } from '@prisma/client'

export interface ProRataCalculation {
  userId: string
  leaveTypeId: string
  year: number
  baseEntitlement: number // Full-time entitlement
  workingDaysPerWeek: number
  fullTimeEquivalent: number // Percentage of full-time (0.5 for half-time, etc.)
  proRataEntitlement: number // Calculated pro-rata amount
  adjustmentReason: string
  effectiveFrom: Date
  effectiveTo?: Date
}

export interface LeaveAllocation {
  leaveTypeId: string
  leaveTypeName: string
  baseEntitlement: number
  proRataEntitlement: number
  startDate: Date
  endDate?: Date
  workingPattern: string
  isProRata: boolean
}

export class ProRataService {
  /**
   * Calculate pro-rata leave entitlement for a user
   */
  static async calculateProRataEntitlement(
    userId: string,
    leaveTypeId: string,
    year: number,
    effectiveFrom?: Date
  ): Promise<ProRataCalculation> {
    // Get user working pattern
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        workingPattern: true,
        workingDaysPerWeek: true,
        workingHoursPerWeek: true,
        contractType: true,
        joiningDate: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Get leave type base entitlement
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
      select: {
        daysAllowed: true,
        name: true,
        code: true
      }
    })

    if (!leaveType) {
      throw new Error('Leave type not found')
    }

    const baseEntitlement = leaveType.daysAllowed
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31)
    const calculationDate = effectiveFrom || startOfYear

    // Calculate FTE (Full Time Equivalent)
    const standardWorkingDays = 5 // Standard full-time working days per week
    const fte = user.workingDaysPerWeek / standardWorkingDays

    // Handle mid-year start
    let yearFraction = 1
    let adjustmentReason = ''

    if (calculationDate > startOfYear) {
      const totalDaysInYear = Math.ceil((endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
      const remainingDaysInYear = Math.ceil((endOfYear.getTime() - calculationDate.getTime()) / (1000 * 60 * 60 * 24))
      yearFraction = remainingDaysInYear / totalDaysInYear
      adjustmentReason = `Mid-year start from ${calculationDate.toDateString()}`
    }

    // Calculate pro-rata entitlement
    let proRataEntitlement = baseEntitlement * fte * yearFraction

    // Handle special cases based on working pattern
    if (user.workingPattern === WorkingPattern.COMPRESSED_HOURS) {
      // Compressed hours usually work full-time hours in fewer days
      // May still be entitled to full leave allocation
      if (user.workingHoursPerWeek >= 35) { // Near full-time hours
        proRataEntitlement = baseEntitlement * yearFraction
        adjustmentReason = adjustmentReason || 'Compressed hours with full-time allocation'
      }
    }

    // Apply minimum entitlements (legal requirements may apply)
    const minimumEntitlement = this.getMinimumEntitlement(leaveType.code, fte)
    if (proRataEntitlement < minimumEntitlement) {
      proRataEntitlement = minimumEntitlement
      adjustmentReason = adjustmentReason || `Adjusted to meet minimum legal requirement of ${minimumEntitlement} days`
    }

    // Round to appropriate precision (quarter days, half days, etc.)
    proRataEntitlement = this.roundEntitlement(proRataEntitlement, user.workingPattern)

    if (!adjustmentReason) {
      adjustmentReason = `Pro-rata calculation: ${user.workingDaysPerWeek} days/week (${Math.round(fte * 100)}% FTE)`
    }

    return {
      userId,
      leaveTypeId,
      year,
      baseEntitlement,
      workingDaysPerWeek: user.workingDaysPerWeek,
      fullTimeEquivalent: fte,
      proRataEntitlement,
      adjustmentReason,
      effectiveFrom: calculationDate,
      effectiveTo: endOfYear
    }
  }

  /**
   * Update user's leave balances with pro-rata calculations
   */
  static async updateProRataBalances(userId: string, year: number): Promise<LeaveAllocation[]> {
    // Get all active leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, daysAllowed: true }
    })

    const allocations: LeaveAllocation[] = []

    for (const leaveType of leaveTypes) {
      const calculation = await this.calculateProRataEntitlement(userId, leaveType.id, year)

      // Update or create leave balance
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId,
            leaveTypeId: leaveType.id,
            year
          }
        },
        update: {
          entitled: calculation.proRataEntitlement,
          available: calculation.proRataEntitlement, // Will be adjusted by used/pending
          updatedAt: new Date()
        },
        create: {
          userId,
          leaveTypeId: leaveType.id,
          year,
          entitled: calculation.proRataEntitlement,
          available: calculation.proRataEntitlement,
          used: 0,
          pending: 0,
          carriedForward: 0
        }
      })

      allocations.push({
        leaveTypeId: leaveType.id,
        leaveTypeName: leaveType.name,
        baseEntitlement: calculation.baseEntitlement,
        proRataEntitlement: calculation.proRataEntitlement,
        startDate: calculation.effectiveFrom,
        endDate: calculation.effectiveTo,
        workingPattern: await this.getWorkingPatternDescription(userId),
        isProRata: calculation.fullTimeEquivalent < 1.0
      })
    }

    return allocations
  }

  /**
   * Recalculate balances after working pattern change
   */
  static async recalculateAfterPatternChange(
    userId: string,
    newWorkingDaysPerWeek: number,
    newWorkingHoursPerWeek: number,
    newPattern: WorkingPattern,
    effectiveFrom: Date
  ): Promise<void> {
    const currentYear = effectiveFrom.getFullYear()
    
    // Update user's working pattern
    await prisma.user.update({
      where: { id: userId },
      data: {
        workingDaysPerWeek: newWorkingDaysPerWeek,
        workingHoursPerWeek: newWorkingHoursPerWeek,
        workingPattern: newPattern,
        updatedAt: new Date()
      }
    })

    // Recalculate for current year and next year
    for (const year of [currentYear, currentYear + 1]) {
      await this.updateProRataBalances(userId, year)
    }
  }

  /**
   * Get minimum legal entitlement (varies by country/leave type)
   */
  private static getMinimumEntitlement(leaveTypeCode: string, fte: number): number {
    // UK statutory minimums (adjust for your country)
    if (leaveTypeCode === 'ANNUAL') {
      return Math.max(20 * fte, 4) // Minimum 4 days regardless of FTE
    }
    
    // Other leave types may have different minimums
    return 0
  }

  /**
   * Round entitlement to appropriate precision
   */
  private static roundEntitlement(entitlement: number, pattern: WorkingPattern): number {
    // For most patterns, round to quarter days (0.25)
    if (pattern === WorkingPattern.PART_TIME || pattern === WorkingPattern.JOB_SHARE) {
      return Math.round(entitlement * 4) / 4 // Quarter day precision
    }
    
    // For compressed hours, round to half days
    if (pattern === WorkingPattern.COMPRESSED_HOURS) {
      return Math.round(entitlement * 2) / 2 // Half day precision
    }
    
    // Full time - round to whole days
    return Math.round(entitlement)
  }

  /**
   * Get human-readable working pattern description
   */
  private static async getWorkingPatternDescription(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        workingPattern: true,
        workingDaysPerWeek: true,
        workingHoursPerWeek: true
      }
    })

    if (!user) return 'Unknown'

    const { workingPattern, workingDaysPerWeek, workingHoursPerWeek } = user

    switch (workingPattern) {
      case WorkingPattern.FULL_TIME:
        return 'Full Time (5 days/week)'
      case WorkingPattern.PART_TIME:
        return `Part Time (${workingDaysPerWeek} days/week, ${workingHoursPerWeek}h/week)`
      case WorkingPattern.COMPRESSED_HOURS:
        return `Compressed Hours (${workingDaysPerWeek} days/week, ${workingHoursPerWeek}h/week)`
      case WorkingPattern.JOB_SHARE:
        return `Job Share (${workingDaysPerWeek} days/week)`
      default:
        return `${workingPattern} (${workingDaysPerWeek} days/week)`
    }
  }

  /**
   * Get pro-rata summary for all users (for HR reporting)
   */
  static async getProRataSummary(year: number): Promise<{
    totalUsers: number,
    partTimeUsers: number,
    totalAdjustment: number,
    avgAdjustment: number,
    patterns: Record<string, number>
  }> {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        workingPattern: true,
        workingDaysPerWeek: true,
        leaveBalances: {
          where: { 
            year,
            leaveType: { code: 'ANNUAL' } // Focus on annual leave
          },
          select: {
            entitled: true,
            leaveType: {
              select: { daysAllowed: true }
            }
          }
        }
      }
    })

    const totalUsers = users.length
    const partTimeUsers = users.filter(u => u.workingDaysPerWeek < 5).length
    
    let totalAdjustment = 0
    const patterns: Record<string, number> = {}

    users.forEach(user => {
      // Count working patterns
      patterns[user.workingPattern] = (patterns[user.workingPattern] || 0) + 1

      // Calculate adjustment amount
      if (user.leaveBalances.length > 0) {
        const balance = user.leaveBalances[0]
        const adjustment = balance.leaveType.daysAllowed - balance.entitled
        totalAdjustment += adjustment
      }
    })

    return {
      totalUsers,
      partTimeUsers,
      totalAdjustment: Math.round(totalAdjustment * 100) / 100,
      avgAdjustment: totalUsers > 0 ? Math.round((totalAdjustment / totalUsers) * 100) / 100 : 0,
      patterns
    }
  }
}