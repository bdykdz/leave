-- Add indexes for frequently queried patterns

-- Leave Request performance indexes
CREATE INDEX IF NOT EXISTS "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest" ("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "LeaveRequest_userId_status_idx" ON "LeaveRequest" ("userId", "status");
CREATE INDEX IF NOT EXISTS "LeaveRequest_status_startDate_idx" ON "LeaveRequest" ("status", "startDate");

-- Holiday Plan performance indexes  
CREATE INDEX IF NOT EXISTS "HolidayPlan_userId_year_idx" ON "HolidayPlan" ("userId", "year");
CREATE INDEX IF NOT EXISTS "HolidayPlan_year_status_idx" ON "HolidayPlan" ("year", "status");

-- Holiday Plan Date performance indexes
CREATE INDEX IF NOT EXISTS "HolidayPlanDate_date_priority_idx" ON "HolidayPlanDate" ("date", "priority");

-- Work From Home performance indexes  
CREATE INDEX IF NOT EXISTS "WorkFromHomeRequest_startDate_endDate_idx" ON "WorkFromHomeRequest" ("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "WorkFromHomeRequest_userId_status_idx" ON "WorkFromHomeRequest" ("userId", "status");

-- User relationship indexes
CREATE INDEX IF NOT EXISTS "User_managerId_idx" ON "User" ("managerId");
CREATE INDEX IF NOT EXISTS "User_departmentDirectorId_idx" ON "User" ("departmentDirectorId"); 
CREATE INDEX IF NOT EXISTS "User_department_isActive_idx" ON "User" ("department", "isActive");

-- Leave Balance optimization
CREATE INDEX IF NOT EXISTS "LeaveBalance_userId_year_idx" ON "LeaveBalance" ("userId", "year");
CREATE INDEX IF NOT EXISTS "LeaveBalance_year_leaveTypeId_idx" ON "LeaveBalance" ("year", "leaveTypeId");

-- Audit Log performance (for upcoming audit feature)
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");

-- Approval workflow indexes
CREATE INDEX IF NOT EXISTS "Approval_leaveRequestId_status_idx" ON "Approval" ("leaveRequestId", "status");
CREATE INDEX IF NOT EXISTS "WFHApproval_workFromHomeRequestId_status_idx" ON "WFHApproval" ("workFromHomeRequestId", "status");