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
      // 1. Clean orphaned approvals (approvals without leave requests)
      const orphanedApprovals = await prisma.approval.deleteMany({
        where: {
          leaveRequest: {
            is: null,
          },
        },
      });
      results.orphanedApprovals = orphanedApprovals.count;
      log.info(`Cleaned ${orphanedApprovals.count} orphaned approvals`);

      // 2. Clean orphaned documents (documents without leave requests)
      const orphanedDocs = await prisma.generatedDocument.findMany({
        where: {
          leaveRequest: {
            is: null,
          },
        },
        select: {
          id: true,
          fileUrl: true,
        },
      });

      // Delete associated signatures first
      for (const doc of orphanedDocs) {
        await prisma.documentSignature.deleteMany({
          where: { documentId: doc.id },
        });
      }

      // Then delete the documents
      const deletedDocs = await prisma.generatedDocument.deleteMany({
        where: {
          id: {
            in: orphanedDocs.map(d => d.id),
          },
        },
      });
      results.orphanedDocuments = deletedDocs.count;
      log.info(`Cleaned ${deletedDocs.count} orphaned documents`);

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

      // 4. Clean expired password reset tokens
      const expiredTokens = await prisma.passwordResetToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      log.info(`Cleaned ${expiredTokens.count} expired password reset tokens`);

      // 5. Clean old audit logs (older than 6 months)
      const oldLogsDate = subMonths(new Date(), 6);
      const oldLogs = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: oldLogsDate },
        },
      });
      results.oldLogs = oldLogs.count;
      log.info(`Cleaned ${oldLogs.count} old audit logs`);

      // 6. Clean orphaned leave balances (for deleted users)
      const orphanedBalances = await prisma.leaveBalance.deleteMany({
        where: {
          user: {
            is: null,
          },
        },
      });
      log.info(`Cleaned ${orphanedBalances.count} orphaned leave balances`);

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

      // 2. Fix approval chains with missing approvers
      const approvalsWithoutApprover = await prisma.approval.findMany({
        where: {
          approver: {
            is: null,
          },
        },
        include: {
          leaveRequest: {
            include: {
              user: {
                include: {
                  manager: true,
                },
              },
            },
          },
        },
      });

      for (const approval of approvalsWithoutApprover) {
        if (approval.leaveRequest?.user?.managerId) {
          await prisma.approval.update({
            where: { id: approval.id },
            data: {
              approverId: approval.leaveRequest.user.managerId,
            },
          });
          results.fixedApprovals++;
        } else {
          // If no manager, cancel the approval
          await prisma.approval.update({
            where: { id: approval.id },
            data: {
              status: 'CANCELLED',
              comments: 'Cancelled due to missing approver',
            },
          });
        }
      }

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