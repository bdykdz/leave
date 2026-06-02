-- Add relational department fields (leadership, hierarchy, user FK).
-- Fully additive and non-destructive: all new columns are nullable, FKs use ON DELETE SET NULL.

-- AlterTable: Department leadership + hierarchy
ALTER TABLE "Department" ADD COLUMN "managerId" TEXT;
ALTER TABLE "Department" ADD COLUMN "directorId" TEXT;
ALTER TABLE "Department" ADD COLUMN "parentDepartmentId" TEXT;

-- AlterTable: User -> Department foreign key
ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;

-- CreateIndex
CREATE INDEX "Department_managerId_idx" ON "Department"("managerId");
CREATE INDEX "Department_directorId_idx" ON "Department"("directorId");
CREATE INDEX "Department_parentDepartmentId_idx" ON "Department"("parentDepartmentId");
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: link existing users to departments by matching the legacy "department" name string.
-- Users whose department string does not match any Department.name are left unlinked (departmentId stays NULL).
UPDATE "User" u
SET "departmentId" = d."id"
FROM "Department" d
WHERE u."department" = d."name"
  AND u."departmentId" IS NULL;
