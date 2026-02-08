import { prisma } from '@/lib/prisma'
import { AuditAction } from '@/lib/utils/audit-log'

export interface AuditContext {
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export interface AuditDetails {
  [key: string]: any
}

export class AuditService {
  /**
   * Log an audit event with comprehensive context
   */
  static async log({
    action,
    entityType,
    entityId,
    userId,
    oldValues,
    newValues,
    details,
    context
  }: {
    action: AuditAction
    entityType: string
    entityId?: string
    userId?: string
    oldValues?: any
    newValues?: any
    details?: AuditDetails
    context?: AuditContext
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          userId: userId || context?.userId,
          oldValues: oldValues ? JSON.stringify(oldValues) : null,
          newValues: newValues ? JSON.stringify(newValues) : null,
          details: {
            ...details,
            sessionId: context?.sessionId,
            requestId: context?.requestId,
            timestamp: new Date().toISOString()
          },
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent
        }
      })
    } catch (error) {
      // Don't throw errors for audit logging failures - log to console instead
      console.error('Audit logging failed:', error)
    }
  }

  /**
   * Log holiday plan actions
   */
  static async logHolidayPlan({
    action,
    planId,
    userId,
    oldPlan,
    newPlan,
    context
  }: {
    action: 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
    planId: string
    userId: string
    oldPlan?: any
    newPlan?: any
    context?: AuditContext
  }) {
    const auditAction = action === 'CREATED' ? AuditAction.CREATE_HOLIDAY_PLAN :
                       action === 'UPDATED' ? AuditAction.UPDATE_HOLIDAY_PLAN :
                       action === 'SUBMITTED' ? AuditAction.SUBMIT_HOLIDAY_PLAN :
                       action === 'APPROVED' ? AuditAction.APPROVE_HOLIDAY_PLAN :
                       AuditAction.REJECT_HOLIDAY_PLAN

    await this.log({
      action: auditAction,
      entityType: 'HolidayPlan',
      entityId: planId,
      userId,
      oldValues: oldPlan,
      newValues: newPlan,
      details: {
        actionType: action,
        planYear: newPlan?.year || oldPlan?.year,
        totalDays: newPlan?.dates?.length || oldPlan?.dates?.length
      },
      context
    })
  }

  /**
   * Log leave request actions
   */
  static async logLeaveRequest({
    action,
    requestId,
    userId,
    oldRequest,
    newRequest,
    context
  }: {
    action: 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
    requestId: string
    userId: string
    oldRequest?: any
    newRequest?: any
    context?: AuditContext
  }) {
    const auditAction = action === 'CREATED' ? AuditAction.CREATE_LEAVE :
                       action === 'UPDATED' ? AuditAction.EDIT_LEAVE :
                       action === 'SUBMITTED' ? AuditAction.EDIT_LEAVE :
                       action === 'APPROVED' ? AuditAction.APPROVE_LEAVE :
                       action === 'REJECTED' ? AuditAction.REJECT_LEAVE :
                       AuditAction.CANCEL_LEAVE

    await this.log({
      action: auditAction,
      entityType: 'LeaveRequest',
      entityId: requestId,
      userId,
      oldValues: oldRequest,
      newValues: newRequest,
      details: {
        actionType: action,
        startDate: newRequest?.startDate || oldRequest?.startDate,
        endDate: newRequest?.endDate || oldRequest?.endDate,
        totalDays: newRequest?.totalDays || oldRequest?.totalDays,
        leaveType: newRequest?.leaveTypeId || oldRequest?.leaveTypeId
      },
      context
    })
  }

  /**
   * Log user authentication events
   */
  static async logAuth({
    action,
    userId,
    email,
    context
  }: {
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_RESET'
    userId?: string
    email?: string
    context?: AuditContext
  }) {
    await this.log({
      action: AuditAction.UPDATE_EMPLOYEE,
      entityType: 'User',
      entityId: userId,
      userId,
      details: {
        actionType: action,
        email,
        successful: !action.includes('FAILED')
      },
      context
    })
  }

  /**
   * Log administrative actions
   */
  static async logAdmin({
    action,
    entityType,
    entityId,
    userId,
    description,
    context
  }: {
    action: 'CONFIG_CHANGE' | 'USER_MANAGEMENT' | 'SYSTEM_MAINTENANCE'
    entityType: string
    entityId?: string
    userId: string
    description: string
    context?: AuditContext
  }) {
    await this.log({
      action: AuditAction.UPDATE_EMPLOYEE,
      entityType,
      entityId,
      userId,
      details: {
        actionType: action,
        description,
        isAdminAction: true
      },
      context
    })
  }

  /**
   * Get audit trail for a specific entity
   */
  static async getAuditTrail(entityType: string, entityId: string) {
    return await prisma.auditLog.findMany({
      where: {
        entityType,
        entityId
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  /**
   * Get user activity log
   */
  static async getUserActivity(userId: string, limit: number = 50) {
    return await prisma.auditLog.findMany({
      where: {
        userId
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })
  }

  /**
   * Get system activity summary
   */
  static async getSystemActivitySummary(days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const activities = await prisma.auditLog.groupBy({
      by: ['action', 'entityType'],
      where: {
        createdAt: {
          gte: startDate
        }
      },
      _count: {
        id: true
      }
    })

    return activities.map(activity => ({
      action: activity.action,
      entityType: activity.entityType,
      count: activity._count.id
    }))
  }
}