-- Migration: Add missing fields to AuditLog and create ApprovalDelegate table
-- This migration adds fields that were missing from the schema but used in the code

-- Add missing fields to AuditLog table
ALTER TABLE "AuditLog" ADD COLUMN "entityType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "details" JSONB;

-- Create ApprovalDelegate table for delegation functionality
CREATE TABLE "ApprovalDelegate" (
    "id" TEXT NOT NULL,
    "delegatorId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalDelegate_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for ApprovalDelegate
CREATE UNIQUE INDEX "ApprovalDelegate_delegatorId_delegateId_startDate_key" ON "ApprovalDelegate"("delegatorId", "delegateId", "startDate");

-- Add foreign key constraints for ApprovalDelegate
ALTER TABLE "ApprovalDelegate" ADD CONSTRAINT "ApprovalDelegate_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegate" ADD CONSTRAINT "ApprovalDelegate_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraint for AuditLog user relation
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;