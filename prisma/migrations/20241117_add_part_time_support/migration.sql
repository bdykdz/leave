-- Add part-time employee support

-- Add working pattern fields to User table
ALTER TABLE "User" ADD COLUMN "workingPattern" TEXT DEFAULT 'FULL_TIME';
ALTER TABLE "User" ADD COLUMN "workingDaysPerWeek" DECIMAL(3,1) DEFAULT 5.0;
ALTER TABLE "User" ADD COLUMN "workingHoursPerWeek" DECIMAL(4,1) DEFAULT 40.0;
ALTER TABLE "User" ADD COLUMN "contractType" TEXT DEFAULT 'PERMANENT';

-- Add comments for clarity
COMMENT ON COLUMN "User"."workingPattern" IS 'Working pattern: FULL_TIME, PART_TIME, COMPRESSED_HOURS';
COMMENT ON COLUMN "User"."workingDaysPerWeek" IS 'Number of working days per week (e.g., 2.5 for half time)';
COMMENT ON COLUMN "User"."workingHoursPerWeek" IS 'Number of working hours per week (e.g., 20 for half time)';
COMMENT ON COLUMN "User"."contractType" IS 'Contract type: PERMANENT, FIXED_TERM, CASUAL';