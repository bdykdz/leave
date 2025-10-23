import { prisma } from '@/lib/prisma'

export enum AuditAction {
  // Leave Management
  APPROVE_LEAVE = 'APPROVE_LEAVE',
  REJECT_LEAVE = 'REJECT_LEAVE',
  CANCEL_LEAVE = 'CANCEL_LEAVE',
  CREATE_LEAVE = 'CREATE_LEAVE',
  EDIT_LEAVE = 'EDIT_LEAVE',
  
  // WFH Management
  APPROVE_WFH = 'APPROVE_WFH',
  REJECT_WFH = 'REJECT_WFH',
  CREATE_WFH = 'CREATE_WFH',
  
  // Employee Management
  CREATE_EMPLOYEE = 'CREATE_EMPLOYEE',
  UPDATE_EMPLOYEE = 'UPDATE_EMPLOYEE',
  DEACTIVATE_EMPLOYEE = 'DEACTIVATE_EMPLOYEE',
  REACTIVATE_EMPLOYEE = 'REACTIVATE_EMPLOYEE',
  
  // Document Management
  VERIFY_DOCUMENT = 'VERIFY_DOCUMENT',
  REJECT_DOCUMENT = 'REJECT_DOCUMENT',
  GENERATE_DOCUMENT = 'GENERATE_DOCUMENT',
  
  // HR Actions
  EXPORT_EMPLOYEE_DATA = 'EXPORT_EMPLOYEE_DATA',
  BULK_APPROVE = 'BULK_APPROVE',
  UPDATE_LEAVE_BALANCE = 'UPDATE_LEAVE_BALANCE',
  MANAGE_HOLIDAYS = 'MANAGE_HOLIDAYS',
}

interface AuditLogParams {
  userId: string
  action: AuditAction | string
  entity: 'LEAVE_REQUEST' | 'WFH_REQUEST' | 'USER' | 'DOCUMENT' | 'HOLIDAY' | 'LEAVE_BALANCE'
  entityId: string
  oldValues?: any
  newValues?: any
  metadata?: {
    ipAddress?: string
    userAgent?: string
    reason?: string
    affectedUserId?: string
  }
}

/**
 * Create an audit log entry for tracking HR actions
 */
export async function createAuditLog({
  userId,
  action,
  entity,
  entityId,
  oldValues,
  newValues,
  metadata
}: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        oldValues,
        newValues,
        details: metadata,
        timestamp: new Date()
      }
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(filters: {
  userId?: string
  entity?: string
  action?: string
  entityId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}) {
  const where: any = {}
  
  if (filters.userId) where.userId = filters.userId
  if (filters.entity) where.entity = filters.entity
  if (filters.action) where.action = filters.action
  if (filters.entityId) where.entityId = filters.entityId
  
  if (filters.startDate || filters.endDate) {
    where.timestamp = {}
    if (filters.startDate) where.timestamp.gte = filters.startDate
    if (filters.endDate) where.timestamp.lte = filters.endDate
  }
  
  return prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: filters.limit || 100
  })
}

/**
 * Helper to log HR document verification
 */
export async function logDocumentVerification(
  userId: string,
  documentId: string,
  approved: boolean,
  notes?: string
) {
  await createAuditLog({
    userId,
    action: approved ? AuditAction.VERIFY_DOCUMENT : AuditAction.REJECT_DOCUMENT,
    entity: 'DOCUMENT',
    entityId: documentId,
    newValues: { approved, notes },
    metadata: { reason: notes }
  })
}

/**
 * Helper to log employee data export
 */
export async function logDataExport(
  userId: string,
  exportType: 'CSV' | 'PDF' | 'EXCEL',
  recordCount: number
) {
  await createAuditLog({
    userId,
    action: AuditAction.EXPORT_EMPLOYEE_DATA,
    entity: 'USER',
    entityId: 'BULK_EXPORT',
    newValues: { 
      exportType, 
      recordCount,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Helper to log leave approval/rejection
 */
export async function logLeaveAction(
  userId: string,
  leaveRequestId: string,
  action: 'APPROVE' | 'REJECT',
  reason?: string
) {
  await createAuditLog({
    userId,
    action: action === 'APPROVE' ? AuditAction.APPROVE_LEAVE : AuditAction.REJECT_LEAVE,
    entity: 'LEAVE_REQUEST',
    entityId: leaveRequestId,
    metadata: { reason }
  })
}