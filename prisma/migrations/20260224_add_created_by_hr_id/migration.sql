-- Migration: Add createdByHrId to LeaveRequest and WorkFromHomeRequest
-- These columns track when HR manually creates requests on behalf of employees

-- Add createdByHrId to LeaveRequest (nullable, no data loss)
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "createdByHrId" TEXT;

-- Add createdByHrId to WorkFromHomeRequest (nullable, no data loss)
ALTER TABLE "WorkFromHomeRequest" ADD COLUMN IF NOT EXISTS "createdByHrId" TEXT;
