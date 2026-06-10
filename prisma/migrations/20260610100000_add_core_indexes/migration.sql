-- Additive index migration for the hottest query patterns.
-- Safe to run on production: IF NOT EXISTS, no data changes, small tables.

-- LeaveRequest: dashboards filter by user+status, status+recency, and date overlap checks
CREATE INDEX IF NOT EXISTS "LeaveRequest_userId_status_idx" ON "LeaveRequest"("userId", "status");
CREATE INDEX IF NOT EXISTS "LeaveRequest_status_createdAt_idx" ON "LeaveRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest"("startDate", "endDate");

-- Approval: pending-approvals lists filter by approver+status; cascades look up by request
CREATE INDEX IF NOT EXISTS "Approval_approverId_status_idx" ON "Approval"("approverId", "status");
CREATE INDEX IF NOT EXISTS "Approval_leaveRequestId_idx" ON "Approval"("leaveRequestId");

-- Notification: unread badge and recency-ordered list per user
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AuditLog: per-user history and entity lookups
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
