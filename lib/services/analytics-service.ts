import { prisma } from '@/lib/prisma'
import { startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval, startOfWeek, endOfWeek } from 'date-fns'

export interface DashboardMetrics {
  totalEmployees: number
  activeRequests: number
  approvalsPending: number
  totalDaysRequested: number
  averageProcessingTime: number
}

export interface LeaveUsageTrend {
  month: string
  totalDays: number
  averagePerEmployee: number
  requestCount: number
}

export interface DepartmentAnalytics {
  department: string
  totalEmployees: number
  totalLeave: number
  averagePerEmployee: number
  pendingRequests: number
  utilizationRate: number
}

export interface ApprovalMetrics {
  averageApprovalTime: number
  approvalRate: number
  escalationRate: number
  topApprovers: Array<{
    name: string
    approvals: number
    averageTime: number
  }>
}

export interface SeasonalAnalytics {
  month: string
  requestVolume: number
  approvalRate: number
  averageDaysRequested: number
  popularLeaveTypes: Array<{
    name: string
    count: number
  }>
}

export interface TeamCoverageAnalytics {
  date: string
  totalEmployees: number
  onLeave: number
  coveragePercentage: number
  criticalCoverage: boolean
  conflicts: number
}

export class AnalyticsService {
  /**
   * Get high-level dashboard metrics
   */
  static async getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
    // Get user's scope (department, managed teams, etc.)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, department: true, id: true }
    })

    if (!user) throw new Error('User not found')

    const currentYear = new Date().getFullYear()
    const whereClause = this.buildScopeFilter(user)

    // Total employees in scope
    const totalEmployees = await prisma.user.count({
      where: { ...whereClause, isActive: true }
    })

    // Active requests (submitted, pending approval)
    const activeRequests = await prisma.leaveRequest.count({
      where: {
        user: whereClause,
        status: { in: ['PENDING'] }
      }
    })

    // Pending approvals (where user is the approver)
    const approvalsPending = await this.getPendingApprovalsCount(userId)

    // Total days requested this year
    const totalDaysResult = await prisma.leaveRequest.aggregate({
      _sum: { totalDays: true },
      where: {
        user: whereClause,
        startDate: { gte: startOfYear(new Date()) },
        status: { in: ['APPROVED', 'PENDING'] }
      }
    })

    // Average processing time (in days)
    const avgProcessingTime = await this.getAverageProcessingTime(whereClause)

    return {
      totalEmployees,
      activeRequests,
      approvalsPending,
      totalDaysRequested: totalDaysResult._sum.totalDays || 0,
      averageProcessingTime: avgProcessingTime
    }
  }

  /**
   * Get leave usage trends over time
   */
  static async getLeaveUsageTrends(userId: string, months: number = 12): Promise<LeaveUsageTrend[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, department: true, id: true }
    })

    if (!user) throw new Error('User not found')

    const whereClause = this.buildScopeFilter(user)
    const endDate = new Date()
    const startDate = subMonths(endDate, months - 1)
    const monthIntervals = eachMonthOfInterval({ start: startDate, end: endDate })

    const trends: LeaveUsageTrend[] = []

    for (const month of monthIntervals) {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      const requests = await prisma.leaveRequest.findMany({
        where: {
          user: whereClause,
          startDate: { gte: monthStart, lte: monthEnd },
          status: 'APPROVED'
        },
        select: { totalDays: true }
      })

      const totalDays = requests.reduce((sum, req) => sum + req.totalDays, 0)
      const requestCount = requests.length

      // Get active employee count for this month
      const activeEmployees = await prisma.user.count({
        where: { ...whereClause, isActive: true }
      })

      trends.push({
        month: format(month, 'MMM yyyy'),
        totalDays,
        averagePerEmployee: activeEmployees > 0 ? totalDays / activeEmployees : 0,
        requestCount
      })
    }

    return trends
  }

  /**
   * Get department analytics
   */
  static async getDepartmentAnalytics(userId: string): Promise<DepartmentAnalytics[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, department: true }
    })

    if (!user) throw new Error('User not found')

    // Get departments based on user role
    let departments: string[] = []
    if (['HR', 'EXECUTIVE', 'ADMIN'].includes(user.role)) {
      // Get all departments
      const allDepts = await prisma.user.findMany({
        where: { isActive: true },
        select: { department: true },
        distinct: ['department']
      })
      departments = allDepts.map(d => d.department)
    } else {
      // Just their department
      departments = [user.department]
    }

    const currentYear = new Date().getFullYear()
    const analytics: DepartmentAnalytics[] = []

    for (const dept of departments) {
      const totalEmployees = await prisma.user.count({
        where: { department: dept, isActive: true }
      })

      const leaveData = await prisma.leaveRequest.aggregate({
        _sum: { totalDays: true },
        _count: { id: true },
        where: {
          user: { department: dept, isActive: true },
          startDate: { gte: startOfYear(new Date()) },
          status: 'APPROVED'
        }
      })

      const pendingRequests = await prisma.leaveRequest.count({
        where: {
          user: { department: dept, isActive: true },
          status: { in: ['PENDING'] }
        }
      })

      const totalLeave = leaveData._sum.totalDays || 0
      const averagePerEmployee = totalEmployees > 0 ? totalLeave / totalEmployees : 0

      // Calculate utilization rate (compared to annual entitlement)
      const utilizationRate = await this.calculateUtilizationRate(dept, currentYear)

      analytics.push({
        department: dept,
        totalEmployees,
        totalLeave,
        averagePerEmployee: Math.round(averagePerEmployee * 100) / 100,
        pendingRequests,
        utilizationRate
      })
    }

    return analytics.sort((a, b) => b.totalLeave - a.totalLeave)
  }

  /**
   * Get approval process metrics
   */
  static async getApprovalMetrics(userId: string): Promise<ApprovalMetrics> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, department: true, id: true }
    })

    if (!user) throw new Error('User not found')

    const currentYear = new Date().getFullYear()

    // Get approvals in scope
    const approvals = await prisma.approval.findMany({
      where: {
        createdAt: { gte: startOfYear(new Date()) },
        leaveRequest: {
          user: this.buildScopeFilter(user)
        }
      },
      include: {
        user: {
          select: { firstName: true, lastName: true }
        },
        leaveRequest: {
          select: { createdAt: true }
        }
      }
    })

    // Calculate average approval time
    const approvalTimes = approvals.filter(a => a.status === 'APPROVED').map(approval => {
      const requestTime = approval.leaveRequest.createdAt.getTime()
      const approvalTime = approval.createdAt.getTime()
      return (approvalTime - requestTime) / (1000 * 60 * 60 * 24) // Days
    })

    const averageApprovalTime = approvalTimes.length > 0
      ? approvalTimes.reduce((a, b) => a + b) / approvalTimes.length
      : 0

    // Calculate approval rate
    const totalApprovals = approvals.length
    const approvedCount = approvals.filter(a => a.status === 'APPROVED').length
    const approvalRate = totalApprovals > 0 ? (approvedCount / totalApprovals) * 100 : 0

    // Calculate escalation rate
    const escalatedCount = approvals.filter(a => a.escalatedTo !== null).length
    const escalationRate = totalApprovals > 0 ? (escalatedCount / totalApprovals) * 100 : 0

    // Top approvers
    const approverStats = new Map<string, { count: number; totalTime: number }>()
    
    approvals.forEach(approval => {
      if (approval.status === 'APPROVED' && approval.user) {
        const approverName = `${approval.user.firstName} ${approval.user.lastName}`
        const approvalTime = approvalTimes.find(() => true) || 0
        
        const existing = approverStats.get(approverName) || { count: 0, totalTime: 0 }
        existing.count++
        existing.totalTime += approvalTime
        approverStats.set(approverName, existing)
      }
    })

    const topApprovers = Array.from(approverStats.entries())
      .map(([name, stats]) => ({
        name,
        approvals: stats.count,
        averageTime: stats.count > 0 ? stats.totalTime / stats.count : 0
      }))
      .sort((a, b) => b.approvals - a.approvals)
      .slice(0, 5)

    return {
      averageApprovalTime: Math.round(averageApprovalTime * 100) / 100,
      approvalRate: Math.round(approvalRate * 100) / 100,
      escalationRate: Math.round(escalationRate * 100) / 100,
      topApprovers
    }
  }

  /**
   * Get seasonal analytics
   */
  static async getSeasonalAnalytics(userId: string): Promise<SeasonalAnalytics[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, department: true, id: true }
    })

    if (!user) throw new Error('User not found')

    const whereClause = this.buildScopeFilter(user)
    const currentYear = new Date().getFullYear()
    const monthIntervals = eachMonthOfInterval({
      start: startOfYear(new Date()),
      end: endOfYear(new Date())
    })

    const analytics: SeasonalAnalytics[] = []

    for (const month of monthIntervals) {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      // Request volume
      const requestVolume = await prisma.leaveRequest.count({
        where: {
          user: whereClause,
          createdAt: { gte: monthStart, lte: monthEnd }
        }
      })

      // Approval rate
      const totalRequests = await prisma.leaveRequest.count({
        where: {
          user: whereClause,
          createdAt: { gte: monthStart, lte: monthEnd },
          status: { in: ['APPROVED', 'REJECTED'] }
        }
      })

      const approvedRequests = await prisma.leaveRequest.count({
        where: {
          user: whereClause,
          createdAt: { gte: monthStart, lte: monthEnd },
          status: 'APPROVED'
        }
      })

      const approvalRate = totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0

      // Average days requested
      const daysData = await prisma.leaveRequest.aggregate({
        _avg: { totalDays: true },
        where: {
          user: whereClause,
          createdAt: { gte: monthStart, lte: monthEnd }
        }
      })

      // Popular leave types
      const leaveTypeStats = await prisma.leaveRequest.groupBy({
        by: ['leaveTypeId'],
        _count: { leaveTypeId: true },
        where: {
          user: whereClause,
          createdAt: { gte: monthStart, lte: monthEnd }
        },
        orderBy: {
          _count: {
            leaveTypeId: 'desc'
          }
        },
        take: 3
      })

      const popularLeaveTypes = await Promise.all(
        leaveTypeStats.map(async (stat) => {
          const leaveType = await prisma.leaveType.findUnique({
            where: { id: stat.leaveTypeId },
            select: { name: true }
          })
          return {
            name: leaveType?.name || 'Unknown',
            count: stat._count.leaveTypeId
          }
        })
      )

      analytics.push({
        month: format(month, 'MMM'),
        requestVolume,
        approvalRate: Math.round(approvalRate * 100) / 100,
        averageDaysRequested: Math.round((daysData._avg.totalDays || 0) * 100) / 100,
        popularLeaveTypes
      })
    }

    return analytics
  }

  /**
   * Get team coverage analytics
   */
  static async getTeamCoverageAnalytics(userId: string, days: number = 30): Promise<TeamCoverageAnalytics[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, department: true, id: true }
    })

    if (!user) throw new Error('User not found')

    const whereClause = this.buildScopeFilter(user)
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)

    const coverage: TeamCoverageAnalytics[] = []
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = new Date(d)
      const dateString = format(date, 'yyyy-MM-dd')

      // Total employees
      const totalEmployees = await prisma.user.count({
        where: { ...whereClause, isActive: true }
      })

      // Employees on leave
      const onLeave = await prisma.leaveRequest.count({
        where: {
          user: whereClause,
          startDate: { lte: date },
          endDate: { gte: date },
          status: 'APPROVED'
        }
      })

      const coveragePercentage = totalEmployees > 0 ? ((totalEmployees - onLeave) / totalEmployees) * 100 : 100
      const criticalCoverage = coveragePercentage < 70 // Less than 70% coverage is critical

      // Count conflicts (multiple people in same team/role on leave)
      const conflicts = await this.detectDailyCoverageConflicts(whereClause, date)

      coverage.push({
        date: dateString,
        totalEmployees,
        onLeave,
        coveragePercentage: Math.round(coveragePercentage * 100) / 100,
        criticalCoverage,
        conflicts
      })
    }

    return coverage
  }

  /**
   * Helper methods
   */
  private static buildScopeFilter(user: any) {
    if (['HR', 'EXECUTIVE', 'ADMIN'].includes(user.role)) {
      return {} // Can see all employees
    } else if (user.role === 'MANAGER') {
      return {
        OR: [
          { managerId: user.id }, // Direct reports
          { department: user.department || 'UNKNOWN' } // Department colleagues
        ]
      }
    } else if (user.role === 'DIRECTOR' || user.role === 'DEPARTMENT_DIRECTOR') {
      return { 
        OR: [
          { departmentDirectorId: user.id },
          { department: user.department || 'UNKNOWN' } // Department employees
        ]
      }
    }
    
    // Default to department scope, fallback to user's own data only
    return user.department 
      ? { department: user.department }
      : { id: user.id } // Only own data if no department
  }

  private static async getPendingApprovalsCount(userId: string): Promise<number> {
    return await prisma.approval.count({
      where: {
        userId,
        status: 'PENDING'
      }
    })
  }

  private static async getAverageProcessingTime(whereClause: any): Promise<number> {
    const approvals = await prisma.approval.findMany({
      where: {
        status: 'APPROVED',
        createdAt: { gte: subMonths(new Date(), 3) },
        leaveRequest: { user: whereClause }
      },
      include: {
        leaveRequest: { select: { createdAt: true } }
      }
    })

    if (approvals.length === 0) return 0

    const totalTime = approvals.reduce((sum, approval) => {
      const processingTime = approval.createdAt.getTime() - approval.leaveRequest.createdAt.getTime()
      return sum + (processingTime / (1000 * 60 * 60 * 24)) // Convert to days
    }, 0)

    return Math.round((totalTime / approvals.length) * 100) / 100
  }

  private static async calculateUtilizationRate(department: string, year: number): Promise<number> {
    const employees = await prisma.user.findMany({
      where: { department, isActive: true },
      include: {
        leaveBalances: {
          where: { year },
          include: { leaveType: true }
        }
      }
    })

    if (employees.length === 0) return 0

    let totalEntitled = 0
    let totalUsed = 0

    employees.forEach(emp => {
      emp.leaveBalances.forEach(balance => {
        totalEntitled += balance.entitled
        totalUsed += balance.used
      })
    })

    return totalEntitled > 0 ? (totalUsed / totalEntitled) * 100 : 0
  }

  private static async detectDailyCoverageConflicts(whereClause: any, date: Date): Promise<number> {
    // This is a simplified conflict detection
    // In practice, you'd check for role-based conflicts, team coverage, etc.
    const overlappingLeave = await prisma.leaveRequest.count({
      where: {
        user: whereClause,
        startDate: { lte: date },
        endDate: { gte: date },
        status: 'APPROVED'
      }
    })

    // Consider it a conflict if more than 2 people are away
    return overlappingLeave > 2 ? 1 : 0
  }
}