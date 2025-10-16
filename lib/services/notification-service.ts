import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
}

export interface NotificationTemplates {
  LEAVE_REQUESTED: (params: { employeeName: string; leaveType: string; dates: string; requestNumber: string }) => { title: string; message: string }
  LEAVE_APPROVED: (params: { leaveType: string; dates: string; approver: string; requestNumber: string }) => { title: string; message: string }
  LEAVE_REJECTED: (params: { leaveType: string; dates: string; reason?: string; requestNumber: string }) => { title: string; message: string }
  LEAVE_CANCELLED: (params: { leaveType: string; dates: string; requestNumber: string }) => { title: string; message: string }
  APPROVAL_REQUIRED: (params: { employeeName: string; leaveType: string; dates: string; requestNumber: string }) => { title: string; message: string }
  DOCUMENT_READY: (params: { requestNumber: string; documentType: string }) => { title: string; message: string }
}

const notificationTemplates: NotificationTemplates = {
  LEAVE_REQUESTED: ({ employeeName, leaveType, dates, requestNumber }) => ({
    title: 'New Leave Request Submitted',
    message: `${employeeName} has submitted a ${leaveType} request for ${dates}. Request #${requestNumber}`
  }),
  
  LEAVE_APPROVED: ({ leaveType, dates, approver, requestNumber }) => ({
    title: 'Leave Request Approved',
    message: `Your ${leaveType} request for ${dates} has been approved by ${approver}. Request #${requestNumber}`
  }),
  
  LEAVE_REJECTED: ({ leaveType, dates, reason, requestNumber }) => ({
    title: 'Leave Request Rejected',
    message: `Your ${leaveType} request for ${dates} has been rejected${reason ? `: ${reason}` : ''}. Request #${requestNumber}`
  }),
  
  LEAVE_CANCELLED: ({ leaveType, dates, requestNumber }) => ({
    title: 'Leave Request Cancelled',
    message: `Your ${leaveType} request for ${dates} has been cancelled. Request #${requestNumber}`
  }),
  
  APPROVAL_REQUIRED: ({ employeeName, leaveType, dates, requestNumber }) => ({
    title: 'Approval Required',
    message: `${employeeName} needs approval for ${leaveType} from ${dates}. Request #${requestNumber}`
  }),
  
  DOCUMENT_READY: ({ requestNumber, documentType }) => ({
    title: 'Document Ready',
    message: `Your ${documentType} document is ready for request #${requestNumber}`
  })
}

export class NotificationService {
  /**
   * Create a single notification
   */
  static async createNotification(params: CreateNotificationParams) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          link: params.link
        }
      })
      
      console.log(`Notification created for user ${params.userId}: ${params.title}`)
      return notification
    } catch (error) {
      console.error('Error creating notification:', error)
      throw error
    }
  }

  /**
   * Create notifications for multiple users
   */
  static async createNotifications(notifications: CreateNotificationParams[]) {
    try {
      const result = await prisma.notification.createMany({
        data: notifications.map(notification => ({
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          link: notification.link
        }))
      })
      
      console.log(`Created ${result.count} notifications`)
      return result
    } catch (error) {
      console.error('Error creating notifications:', error)
      throw error
    }
  }

  /**
   * Create notification using template
   */
  static async createFromTemplate<T extends NotificationType>(
    userId: string,
    type: T,
    templateParams: Parameters<NotificationTemplates[T]>[0],
    link?: string
  ) {
    const template = notificationTemplates[type]
    const { title, message } = template(templateParams as any)
    
    return this.createNotification({
      userId,
      type,
      title,
      message,
      link
    })
  }

  /**
   * Create notifications for leave request submission
   * Notifies managers and HR about new leave request
   */
  static async notifyLeaveRequestSubmitted(
    leaveRequestId: string,
    employeeId: string,
    employeeName: string,
    leaveType: string,
    dates: string,
    requestNumber: string,
    managerIds: string[],
    hrIds: string[]
  ) {
    const link = `/manager?request=${leaveRequestId}`
    const notifications: CreateNotificationParams[] = []

    // Notify managers
    for (const managerId of managerIds) {
      notifications.push({
        userId: managerId,
        type: 'APPROVAL_REQUIRED',
        ...notificationTemplates.APPROVAL_REQUIRED({ employeeName, leaveType, dates, requestNumber }),
        link
      })
    }

    // Notify HR (if leave requires HR verification)
    for (const hrId of hrIds) {
      notifications.push({
        userId: hrId,
        type: 'LEAVE_REQUESTED',
        ...notificationTemplates.LEAVE_REQUESTED({ employeeName, leaveType, dates, requestNumber }),
        link: `/hr?request=${leaveRequestId}`
      })
    }

    if (notifications.length > 0) {
      return this.createNotifications(notifications)
    }
  }

  /**
   * Create notification for leave request approval/rejection
   */
  static async notifyLeaveRequestDecision(
    employeeId: string,
    approved: boolean,
    leaveType: string,
    dates: string,
    requestNumber: string,
    approverName: string,
    reason?: string,
    leaveRequestId?: string
  ) {
    const link = leaveRequestId ? `/employee?request=${leaveRequestId}` : undefined
    
    if (approved) {
      return this.createFromTemplate(
        employeeId,
        'LEAVE_APPROVED',
        { leaveType, dates, approver: approverName, requestNumber },
        link
      )
    } else {
      return this.createFromTemplate(
        employeeId,
        'LEAVE_REJECTED',
        { leaveType, dates, reason, requestNumber },
        link
      )
    }
  }

  /**
   * Create notification for leave cancellation
   */
  static async notifyLeaveCancelled(
    employeeId: string,
    leaveType: string,
    dates: string,
    requestNumber: string,
    leaveRequestId?: string
  ) {
    const link = leaveRequestId ? `/employee?request=${leaveRequestId}` : undefined
    
    return this.createFromTemplate(
      employeeId,
      'LEAVE_CANCELLED',
      { leaveType, dates, requestNumber },
      link
    )
  }

  /**
   * Create notification for document ready
   */
  static async notifyDocumentReady(
    employeeId: string,
    requestNumber: string,
    documentType: string,
    documentId?: string
  ) {
    const link = documentId ? `/documents/${documentId}` : undefined
    
    return this.createFromTemplate(
      employeeId,
      'DOCUMENT_READY',
      { requestNumber, documentType },
      link
    )
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.update({
        where: {
          id: notificationId,
          userId // Ensure user can only mark their own notifications as read
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })
      
      return notification
    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })
      
      return result
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      throw error
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.delete({
        where: {
          id: notificationId,
          userId // Ensure user can only delete their own notifications
        }
      })
      
      return notification
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  }

  /**
   * Get user notifications with pagination
   */
  static async getUserNotifications(
    userId: string,
    options: {
      limit?: number
      offset?: number
      unreadOnly?: boolean
    } = {}
  ) {
    const { limit = 50, offset = 0, unreadOnly = false } = options
    
    try {
      const where: any = { userId }
      if (unreadOnly) {
        where.isRead = false
      }

      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.notification.count({
          where: {
            userId,
            isRead: false
          }
        })
      ])

      return {
        notifications,
        unreadCount,
        total: notifications.length
      }
    } catch (error) {
      console.error('Error fetching user notifications:', error)
      throw error
    }
  }

  /**
   * Cleanup old read notifications (older than 30 days)
   */
  static async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    try {
      const result = await prisma.notification.deleteMany({
        where: {
          isRead: true,
          readAt: {
            lt: thirtyDaysAgo
          }
        }
      })

      console.log(`Cleaned up ${result.count} old notifications`)
      return result
    } catch (error) {
      console.error('Error cleaning up old notifications:', error)
      throw error
    }
  }
}