import { prisma } from '@/lib/prisma'
import { addDays, subDays, startOfWeek, endOfWeek, isWeekend, format, isSameDay } from 'date-fns'

export interface ConflictInfo {
  date: Date
  conflictLevel: 'low' | 'medium' | 'high'
  conflictingRequests: {
    employeeName: string
    leaveType: string
    department: string
  }[]
  teamSize: number
  impactScore: number
}

export interface DateSuggestion {
  date: Date
  score: number
  reason: string
  conflictLevel: 'none' | 'low' | 'medium' | 'high'
  availableTeamMembers: number
  totalTeamMembers: number
}

export interface ConflictResolution {
  originalDates: Date[]
  conflicts: ConflictInfo[]
  suggestions: DateSuggestion[]
  recommendations: string[]
}

export class ConflictResolutionService {
  // Analyze conflicts for requested dates
  static async analyzeConflicts(
    managerId: string, 
    requestedDates: Date[], 
    excludeRequestId?: string
  ): Promise<ConflictResolution> {
    const conflicts: ConflictInfo[] = []
    const suggestions: DateSuggestion[] = []
    const recommendations: string[] = []

    // Get team information
    const teamMembers = await prisma.user.findMany({
      where: {
        managerId: managerId,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true
      }
    })

    const teamSize = teamMembers.length

    // Analyze each requested date for conflicts
    for (const date of requestedDates) {
      const conflict = await this.analyzeDate(date, managerId, teamSize, excludeRequestId)
      if (conflict.conflictLevel !== 'low') {
        conflicts.push(conflict)
      }
    }

    // Generate alternative date suggestions if conflicts exist
    if (conflicts.length > 0) {
      const alternatives = await this.generateAlternativeDates(
        requestedDates, 
        managerId, 
        teamSize,
        excludeRequestId
      )
      suggestions.push(...alternatives)

      // Generate recommendations
      recommendations.push(...this.generateRecommendations(conflicts, suggestions))
    }

    return {
      originalDates: requestedDates,
      conflicts,
      suggestions,
      recommendations
    }
  }

  // Analyze a specific date for conflicts
  private static async analyzeDate(
    date: Date, 
    managerId: string, 
    teamSize: number,
    excludeRequestId?: string
  ): Promise<ConflictInfo> {
    // Get all approved/pending leave requests for this date
    const whereClause: any = {
      user: {
        managerId: managerId
      },
      status: {
        in: ['APPROVED', 'PENDING']
      },
      startDate: { lte: date },
      endDate: { gte: date }
    }

    if (excludeRequestId) {
      whereClause.id = { not: excludeRequestId }
    }

    const conflictingRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            department: true
          }
        },
        leaveType: {
          select: {
            name: true
          }
        }
      }
    })

    const conflictCount = conflictingRequests.length
    const conflictPercentage = (conflictCount / teamSize) * 100

    // Calculate conflict level based on percentage of team away
    let conflictLevel: 'low' | 'medium' | 'high'
    if (conflictPercentage >= 50) {
      conflictLevel = 'high'
    } else if (conflictPercentage >= 30) {
      conflictLevel = 'medium'
    } else {
      conflictLevel = 'low'
    }

    // Calculate impact score (higher = worse impact)
    const impactScore = this.calculateImpactScore(conflictCount, teamSize, date)

    return {
      date,
      conflictLevel,
      conflictingRequests: conflictingRequests.map(req => ({
        employeeName: `${req.user.firstName} ${req.user.lastName}`,
        leaveType: req.leaveType.name,
        department: req.user.department || 'Unknown'
      })),
      teamSize,
      impactScore
    }
  }

  // Generate alternative date suggestions
  private static async generateAlternativeDates(
    originalDates: Date[],
    managerId: string,
    teamSize: number,
    excludeRequestId?: string
  ): Promise<DateSuggestion[]> {
    const suggestions: DateSuggestion[] = []
    const startDate = originalDates[0]
    const endDate = originalDates[originalDates.length - 1]
    const duration = originalDates.length

    // Generate suggestions for +/- 4 weeks around original dates
    const searchStart = subDays(startDate, 28)
    const searchEnd = addDays(endDate, 28)

    // Score different date ranges
    const candidateRanges = this.generateCandidateRanges(searchStart, searchEnd, duration)

    for (const range of candidateRanges) {
      // Skip if overlaps with original dates
      const overlapsOriginal = range.some(date => 
        originalDates.some(origDate => isSameDay(date, origDate))
      )
      
      if (overlapsOriginal) continue

      // Score this range
      const score = await this.scoreDateRange(range, managerId, teamSize, excludeRequestId)
      if (score.score > 0) {
        suggestions.push(score)
      }
    }

    // Sort by score (higher is better) and return top 5
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }

  // Generate candidate date ranges for suggestions
  private static generateCandidateRanges(
    searchStart: Date,
    searchEnd: Date,
    duration: number
  ): Date[][] {
    const ranges: Date[][] = []
    let current = searchStart

    while (current <= subDays(searchEnd, duration - 1)) {
      // Skip weekends for start dates
      if (!isWeekend(current)) {
        const range: Date[] = []
        for (let i = 0; i < duration; i++) {
          const date = addDays(current, i)
          range.push(date)
        }
        ranges.push(range)
      }
      current = addDays(current, 1)
    }

    return ranges
  }

  // Score a date range for suitability
  private static async scoreDateRange(
    dateRange: Date[],
    managerId: string,
    teamSize: number,
    excludeRequestId?: string
  ): Promise<DateSuggestion> {
    const startDate = dateRange[0]
    let totalConflicts = 0
    let maxConflictsOnAnyDay = 0

    // Analyze conflicts for each date in the range
    for (const date of dateRange) {
      const conflict = await this.analyzeDate(date, managerId, teamSize, excludeRequestId)
      const conflictCount = conflict.conflictingRequests.length
      totalConflicts += conflictCount
      maxConflictsOnAnyDay = Math.max(maxConflictsOnAnyDay, conflictCount)
    }

    const avgConflictsPerDay = dateRange.length > 0 ? totalConflicts / dateRange.length : 0
    const maxConflictPercentage = teamSize > 0 ? (maxConflictsOnAnyDay / teamSize) * 100 : 0

    // Calculate score (0-100, higher is better)
    let score = 100
    score -= avgConflictsPerDay * 15 // Penalize average conflicts
    score -= maxConflictPercentage * 2 // Heavily penalize peak conflicts
    
    // Bonus for Monday-Friday ranges
    const weekdayCount = dateRange.filter(date => !isWeekend(date)).length
    const weekdayRatio = dateRange.length > 0 ? weekdayCount / dateRange.length : 0
    score += weekdayRatio * 10

    // Ensure score is not negative
    score = Math.max(0, score)

    // Determine conflict level
    let conflictLevel: 'none' | 'low' | 'medium' | 'high'
    if (maxConflictPercentage === 0) {
      conflictLevel = 'none'
    } else if (maxConflictPercentage < 20) {
      conflictLevel = 'low'
    } else if (maxConflictPercentage < 40) {
      conflictLevel = 'medium'
    } else {
      conflictLevel = 'high'
    }

    const reason = this.generateScoreReason(avgConflictsPerDay, maxConflictPercentage, weekdayRatio)
    const availableTeamMembers = teamSize - maxConflictsOnAnyDay

    return {
      date: startDate,
      score: Math.round(score),
      reason,
      conflictLevel,
      availableTeamMembers,
      totalTeamMembers: teamSize
    }
  }

  // Generate human-readable reason for score
  private static generateScoreReason(
    avgConflicts: number, 
    maxConflictPercentage: number, 
    weekdayRatio: number
  ): string {
    const reasons: string[] = []

    if (maxConflictPercentage === 0) {
      reasons.push('No team conflicts')
    } else if (maxConflictPercentage < 20) {
      reasons.push('Minimal team impact')
    } else if (maxConflictPercentage < 40) {
      reasons.push('Moderate team impact')
    } else {
      reasons.push('High team impact')
    }

    if (weekdayRatio === 1) {
      reasons.push('All business days')
    } else if (weekdayRatio > 0.7) {
      reasons.push('Mostly business days')
    }

    if (avgConflicts < 0.5) {
      reasons.push('Good availability')
    } else if (avgConflicts < 1) {
      reasons.push('Fair availability')
    }

    return reasons.join(', ')
  }

  // Calculate impact score for a date
  private static calculateImpactScore(conflictCount: number, teamSize: number, date: Date): number {
    const baseScore = (conflictCount / teamSize) * 100
    
    // Weekend penalty (less impact)
    const weekendMultiplier = isWeekend(date) ? 0.5 : 1.0
    
    // Monday/Friday bonus impact (higher impact)
    const dayOfWeek = date.getDay()
    const mondayFridayMultiplier = (dayOfWeek === 1 || dayOfWeek === 5) ? 1.2 : 1.0

    return baseScore * weekendMultiplier * mondayFridayMultiplier
  }

  // Generate actionable recommendations
  private static generateRecommendations(
    conflicts: ConflictInfo[],
    suggestions: DateSuggestion[]
  ): string[] {
    const recommendations: string[] = []

    const highConflicts = conflicts.filter(c => c.conflictLevel === 'high')
    const mediumConflicts = conflicts.filter(c => c.conflictLevel === 'medium')

    if (highConflicts.length > 0) {
      recommendations.push(
        `⚠️ High conflict detected: ${highConflicts.length} date(s) have 50%+ team unavailability`
      )
    }

    if (mediumConflicts.length > 0) {
      recommendations.push(
        `⚡ Medium conflict: ${mediumConflicts.length} date(s) have 30%+ team unavailability`
      )
    }

    if (suggestions.length > 0) {
      const bestSuggestion = suggestions[0]
      recommendations.push(
        `✅ Best alternative: ${format(bestSuggestion.date, 'MMM dd')} (${bestSuggestion.reason.toLowerCase()})`
      )

      const excellentSuggestions = suggestions.filter(s => s.score >= 80)
      if (excellentSuggestions.length > 1) {
        recommendations.push(
          `💡 ${excellentSuggestions.length} excellent alternatives available with minimal conflicts`
        )
      }
    }

    if (conflicts.length > 0 && suggestions.length === 0) {
      recommendations.push(
        `⏳ Consider extending search window or reducing leave duration for better alternatives`
      )
    }

    return recommendations
  }

  // Get team availability summary for a date range
  static async getTeamAvailability(
    managerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    date: string
    available: number
    onLeave: number
    total: number
    percentage: number
  }[]> {
    const teamMembers = await prisma.user.findMany({
      where: {
        managerId: managerId,
        isActive: true
      }
    })

    const teamSize = teamMembers.length
    const dates: Date[] = []
    let current = startDate

    while (current <= endDate) {
      dates.push(new Date(current))
      current = addDays(current, 1)
    }

    const availability = []

    for (const date of dates) {
      const onLeaveCount = await prisma.leaveRequest.count({
        where: {
          user: {
            managerId: managerId
          },
          status: {
            in: ['APPROVED', 'PENDING']
          },
          startDate: { lte: date },
          endDate: { gte: date }
        }
      })

      const available = teamSize - onLeaveCount
      const percentage = teamSize > 0 ? Math.round((available / teamSize) * 100) : 100

      availability.push({
        date: format(date, 'yyyy-MM-dd'),
        available,
        onLeave: onLeaveCount,
        total: teamSize,
        percentage
      })
    }

    return availability
  }
}