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

    // Fetch all approved requests across the whole window in one query,
    // then bucket per month in memory (same per-month predicate as before:
    // startDate within [monthStart, monthEnd]).
    const windowStart = startOfMonth(monthIntervals[0])
    const windowEnd = endOfMonth(monthIntervals[monthIntervals.length - 1])

    const allRequests = await prisma.leaveRequest.findMany({
      where: {
        user: whereClause,
        startDate: { gte: windowStart, lte: windowEnd },
        status: 'APPROVED'
      },
      select: { startDate: true, totalDays: true }
    })

    // Active employee count does not vary by month - query once
    const activeEmployees = await prisma.user.count({
      where: { ...whereClause, isActive: true }
    })

    for (const month of monthIntervals) {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      const requests = allRequests.filter(
        req => req.startDate >= monthStart && req.startDate <= monthEnd
      )

      const totalDays = requests.reduce((sum, req) => sum + req.totalDays, 0)
      const requestCount = requests.length

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

    // Batched queries (instead of 4 queries per department):
    // 1) All active employees in scope with their current-year balances
    //    (provides both per-department headcount and utilization data)
    const employees = await prisma.user.findMany({
      where: { department: { in: departments }, isActive: true },
      select: {
        department: true,
        leaveBalances: {
          where: { year: currentYear },
          select: { entitled: true, used: true }
        }
      }
    })

    // 2) Approved requests starting this year, grouped per department in memory
    const approvedRequests = await prisma.leaveRequest.findMany({
      where: {
        user: { department: { in: departments }, isActive: true },
        startDate: { gte: startOfYear(new Date()) },
        status: 'APPROVED'
      },
      select: { totalDays: true, user: { select: { department: true } } }
    })

    // 3) Pending requests, grouped per department in memory
    const pendingRequestRows = await prisma.leaveRequest.findMany({
      where: {
        user: { department: { in: departments }, isActive: true },
        status: { in: ['PENDING'] }
      },
      select: { user: { select: { department: true } } }
    })

    // Aggregate in memory
    const employeeStats = new Map<string, { count: number; totalEntitled: number; totalUsed: number }>()
    for (const emp of employees) {
      const stats = employeeStats.get(emp.department) || { count: 0, totalEntitled: 0, totalUsed: 0 }
      stats.count++
      for (const balance of emp.leaveBalances) {
        stats.totalEntitled += balance.entitled
        stats.totalUsed += balance.used
      }
      employeeStats.set(emp.department, stats)
    }

    const leaveStats = new Map<string, number>()
    for (const req of approvedRequests) {
      leaveStats.set(req.user.department, (leaveStats.get(req.user.department) || 0) + req.totalDays)
    }

    const pendingStats = new Map<string, number>()
    for (const req of pendingRequestRows) {
      pendingStats.set(req.user.department, (pendingStats.get(req.user.department) || 0) + 1)
    }

    for (const dept of departments) {
      const empStats = employeeStats.get(dept)
      const totalEmployees = empStats?.count || 0
      const totalLeave = leaveStats.get(dept) || 0
      const pendingRequests = pendingStats.get(dept) || 0
      const averagePerEmployee = totalEmployees > 0 ? totalLeave / totalEmployees : 0

      // Utilization rate (compared to annual entitlement) - same semantics as before:
      // 0 when no employees or no entitlement
      const utilizationRate = empStats && empStats.totalEntitled > 0
        ? (empStats.totalUsed / empStats.totalEntitled) * 100
        : 0

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
        approver: {
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
    const escalatedCount = approvals.filter(a => a.escalatedToId !== null).length
    const escalationRate = totalApprovals > 0 ? (escalatedCount / totalApprovals) * 100 : 0

    // Top approvers
    const approverStats = new Map<string, { count: number; totalTime: number }>()
    
    approvals.forEach(approval => {
      if (approval.status === 'APPROVED' && approval.approver) {
        const approverName = `${approval.approver.firstName} ${approval.approver.lastName}`
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

    // Fetch every request created this year in one query, then bucket per
    // month in memory (same per-month predicate as before: createdAt within
    // [monthStart, monthEnd]).
    const yearRequests = await prisma.leaveRequest.findMany({
      where: {
        user: whereClause,
        createdAt: {
          gte: startOfMonth(monthIntervals[0]),
          lte: endOfMonth(monthIntervals[monthIntervals.length - 1])
        }
      },
      select: { createdAt: true, status: true, totalDays: true, leaveTypeId: true }
    })

    // Resolve leave type names with a single batched query
    const leaveTypeIds = Array.from(new Set(yearRequests.map(req => req.leaveTypeId)))
    const leaveTypes = leaveTypeIds.length > 0
      ? await prisma.leaveType.findMany({
          where: { id: { in: leaveTypeIds } },
          select: { id: true, name: true }
        })
      : []
    const leaveTypeNames = new Map(leaveTypes.map(lt => [lt.id, lt.name]))

    for (const month of monthIntervals) {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      const monthRequests = yearRequests.filter(
        req => req.createdAt >= monthStart && req.createdAt <= monthEnd
      )

      // Request volume
      const requestVolume = monthRequests.length

      // Approval rate (decided requests only)
      const totalRequests = monthRequests.filter(
        req => req.status === 'APPROVED' || req.status === 'REJECTED'
      ).length
      const approvedRequests = monthRequests.filter(req => req.status === 'APPROVED').length
      const approvalRate = totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0

      // Average days requested
      const averageDays = monthRequests.length > 0
        ? monthRequests.reduce((sum, req) => sum + req.totalDays, 0) / monthRequests.length
        : 0

      // Popular leave types (top 3 by request count this month)
      const typeCounts = new Map<string, number>()
      for (const req of monthRequests) {
        typeCounts.set(req.leaveTypeId, (typeCounts.get(req.leaveTypeId) || 0) + 1)
      }
      const popularLeaveTypes = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([leaveTypeId, count]) => ({
          name: leaveTypeNames.get(leaveTypeId) || 'Unknown',
          count
        }))

      analytics.push({
        month: format(month, 'MMM'),
        requestVolume,
        approvalRate: Math.round(approvalRate * 100) / 100,
        averageDaysRequested: Math.round(averageDays * 100) / 100,
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

    // Total employees does not vary by day - query once
    const totalEmployees = await prisma.user.count({
      where: { ...whereClause, isActive: true }
    })

    // Fetch all approved requests overlapping the window in one query, then
    // count per day in memory using the exact same per-day predicate as
    // before: startDate <= date AND endDate >= date
    const approvedRequests = await prisma.leaveRequest.findMany({
      where: {
        user: whereClause,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        status: 'APPROVED'
      },
      select: { startDate: true, endDate: true }
    })

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = new Date(d)
      const dateString = format(date, 'yyyy-MM-dd')

      // Employees on leave
      const onLeave = approvedRequests.filter(
        req => req.startDate <= date && req.endDate >= date
      ).length

      const coveragePercentage = totalEmployees > 0 ? ((totalEmployees - onLeave) / totalEmployees) * 100 : 100
      const criticalCoverage = coveragePercentage < 70 // Less than 70% coverage is critical

      // Count conflicts (multiple people in same team/role on leave).
      // Same simplified rule as the previous detectDailyCoverageConflicts
      // helper, which counted the identical overlapping-leave set:
      // it's a conflict if more than 2 people are away
      const conflicts = onLeave > 2 ? 1 : 0

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
        approverId: userId,
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

}