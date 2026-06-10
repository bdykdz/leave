import { PrismaClient } from '@prisma/client';
import { log } from './logger';
import { subDays, subMonths } from 'date-fns';

const prisma = new PrismaClient();

export class CleanupService {
  /**
   * Clean up orphaned records and old data
   */
  static async performCleanup(): Promise<{
    orphanedApprovals: number;
    orphanedDocuments: number;
    oldNotifications: number;
    expiredSessions: number;
    oldLogs: number;
    errors: string[];
  }> {
    const results = {
      orphanedApprovals: 0,
      orphanedDocuments: 0,
      oldNotifications: 0,
      expiredSessions: 0,
      oldLogs: 0,
      errors: [] as string[],
    };

    try {
      // 1. & 2. Orphaned approvals/documents cannot exist: Approval.leaveRequest and
      // GeneratedDocument.leaveRequest are required relations enforced by FK constraints
      // (with onDelete: Cascade for approvals). The previous `leaveRequest: { is: null }`
      // filters were invalid for required relations and crashed the whole cleanup run.
      log.info('Skipped orphaned approvals/documents cleanup - enforced by FK constraints');

      // 3. Clean old notifications (older than 30 days and read)
      const oldNotificationsDate = subDays(new Date(), 30);
      const oldNotifications = await prisma.notification.deleteMany({
        where: {
          AND: [
            { createdAt: { lt: oldNotificationsDate } },
            { isRead: true },
          ],
        },
      });
      results.oldNotifications = oldNotifications.count;
      log.info(`Cleaned ${oldNotifications.count} old notifications`);

      // 4. Skip password reset tokens cleanup - table doesn't exist
      // Note: Password reset tokens cleanup disabled as table is not defined
      log.info('Skipped password reset tokens cleanup - table not defined');

      // 5. Clean old audit logs (older than 6 months)
      const oldLogsDate = subMonths(new Date(), 6);
      const oldLogs = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: oldLogsDate },
        },
      });
      results.oldLogs = oldLogs.count;
      log.info(`Cleaned ${oldLogs.count} old audit logs`);

      // 6. Orphaned leave balances cannot exist: LeaveBalance.user is a required
      // relation with onDelete: Cascade. The previous `user: null` filter was invalid
      // for a required relation and crashed at runtime.
      log.info('Skipped orphaned leave balances cleanup - enforced by FK cascade');

      // 7. Clean cancelled leave requests older than 1 year
      const oldCancelledDate = subMonths(new Date(), 12);
      const oldCancelled = await prisma.leaveRequest.deleteMany({
        where: {
          AND: [
            { status: 'CANCELLED' },
            { createdAt: { lt: oldCancelledDate } },
          ],
        },
      });
      log.info(`Cleaned ${oldCancelled.count} old cancelled requests`);

    } catch (error) {
      log.error('Cleanup error', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return results;
  }

  /**
   * Fix data inconsistencies
   */
  static async fixInconsistencies(): Promise<{
    fixedBalances: number;
    fixedApprovals: number;
    errors: string[];
  }> {
    const results = {
      fixedBalances: 0,
      fixedApprovals: 0,
      errors: [] as string[],
    };

    try {
      // 1. Recalculate leave balances
      const currentYear = new Date().getFullYear();
      const users = await prisma.user.findMany({
        where: { isActive: true },
        include: {
          leaveBalances: {
            where: { year: currentYear },
          },
          leaveRequests: {
            where: {
              AND: [
                { createdAt: { gte: new Date(`${currentYear}-01-01`) } },
                { status: { in: ['APPROVED', 'PENDING'] } },
              ],
            },
          },
        },
      });

      for (const user of users) {
        for (const balance of user.leaveBalances) {
          const approved = user.leaveRequests
            .filter(r => r.status === 'APPROVED' && r.leaveTypeId === balance.leaveTypeId)
            .reduce((sum, r) => sum + r.totalDays, 0);
          
          const pending = user.leaveRequests
            .filter(r => r.status === 'PENDING' && r.leaveTypeId === balance.leaveTypeId)
            .reduce((sum, r) => sum + r.totalDays, 0);

          const shouldBeAvailable = balance.entitled + balance.carriedForward - approved - pending;
          
          if (Math.abs(balance.available - shouldBeAvailable) > 0.01) {
            await prisma.leaveBalance.update({
              where: { id: balance.id },
              data: {
                used: approved,
                pending,
                available: shouldBeAvailable,
              },
            });
            results.fixedBalances++;
          }
        }
      }

      // 2. Approvals without an approver cannot exist: Approval.approver is a required
      // relation enforced by an FK constraint (onDelete: Cascade). The previous
      // `approver: null` filter was invalid for a required relation and crashed at runtime.
      log.info('Skipped approvals-without-approver fix - enforced by FK constraint');

    } catch (error) {
      log.error('Fix inconsistencies error', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return results;
  }

  /**
   * Archive old data
   */
  static async archiveOldData(): Promise<{
    archivedRequests: number;
    archivedDocuments: number;
    errors: string[];
  }> {
    const results = {
      archivedRequests: 0,
      archivedDocuments: 0,
      errors: [] as string[],
    };

    try {
      // Archive completed leave requests older than 2 years
      const archiveDate = subMonths(new Date(), 24);
      
      // You would typically move these to an archive table
      // For now, we'll just mark them with a flag (if such field exists)
      const oldRequests = await prisma.leaveRequest.findMany({
        where: {
          AND: [
            { status: 'APPROVED' },
            { endDate: { lt: archiveDate } },
          ],
        },
        select: { id: true },
      });

      // In a real implementation, you'd move these to an archive table
      // For demonstration, we'll just log them
      results.archivedRequests = oldRequests.length;
      log.info(`Found ${oldRequests.length} requests to archive`);

    } catch (error) {
      log.error('Archive error', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return results;
  }
}