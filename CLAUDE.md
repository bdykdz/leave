# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: DATABASE MANAGEMENT RULES

### NEVER DROP THE DATABASE WITHOUT EXPLICIT USER PERMISSION
- **NEVER** run `npm run db:reset` without asking the user first
- **NEVER** run `docker-compose down -v` without explicit permission
- **NEVER** run any command that drops or resets the database without confirmation
- The database contains real user data and dropping it will require re-importing all users

### Safe Database Commands
- `npx prisma db push` - Updates schema without dropping data
- `npx prisma migrate dev` - Creates migrations without data loss
- `npx prisma generate` - Regenerates Prisma client

### If Schema Changes Are Needed
1. Always use migrations instead of reset
2. If reset is absolutely necessary, ALWAYS ask: "This will delete all data. Are you sure?"
3. Remind user to backup data first

## Commands

```bash
# Development (npm — there is a package-lock.json, not pnpm)
npm run dev           # Start development server on http://localhost:3000
npm run build         # Build production application
npm run start         # Start production server
npm run lint          # Run ESLint
npm run typecheck     # tsc --noEmit (must stay at 0 errors)
npm test              # Vitest unit tests (tests/unit/)

# Database (requires Docker)
pnpm db:up            # Start PostgreSQL, Redis, MinIO containers
pnpm db:down          # Stop containers
pnpm db:setup         # Full setup: up + migrate + seed
pnpm db:migrate       # Run Prisma migrations
pnpm db:seed          # Seed database with tsx prisma/seed.ts
pnpm db:studio        # Open Prisma Studio GUI
pnpm db:generate      # Regenerate Prisma client

# Production database
npx prisma migrate deploy   # Apply migrations in production
```

## Architecture

Next.js 15 leave management application with App Router, role-based dashboards, and multi-level approval workflows.

### Core Stack
- **Next.js 15.2.6** with App Router and standalone output
- **React 19** with TypeScript 5
- **Prisma 6.9** with PostgreSQL 15
- **NextAuth 4.24** with JWT sessions (Azure AD SSO)
- **Tailwind CSS 3.4** + **shadcn/ui** components
- **react-hook-form** + **Zod** for validation

### Key Services
- **Email**: Resend for notifications (`lib/email-service.ts`)
- **Storage**: MinIO for S3-compatible file storage (`lib/minio.ts`)
- **Documents**: docxtemplater + pdf-lib for generation (`lib/smart-document-generator.ts`)
- **Cache**: Redis via ioredis (`lib/services/cache-service.ts`)
- **Monitoring**: Sentry for error tracking

### Role-Based Routes
```
/             → Redirects to role-appropriate dashboard
/employee     → Leave requests, balances, calendar
/manager      → Team approvals, substitution management
/hr           → User management, leave policies, reports
/executive    → Analytics, company-wide dashboards
/admin        → System configuration, user import
/setup        → Initial Azure AD configuration (requires SETUP_PASSWORD)
```

### API Structure
API routes in `/app/api/` follow REST patterns:
- `/api/leave-requests/` - CRUD with approval actions
- `/api/wfh-requests/` - Work-from-home management
- `/api/holiday-planning/` - Team holiday coordination
- `/api/documents/` - Template generation and signing
- `/api/manager/`, `/api/hr/`, `/api/executive/` - Role-specific endpoints
- `/api/cron/` - Scheduled jobs (escalation, cleanup)

### Key Patterns

**Authentication**: JWT sessions, NOT database sessions. The Prisma adapter must NOT be used with NextAuth. Users must exist in database before SSO sign-in.

**Approval Workflows**: Multi-level chains defined in `lib/services/workflow-engine.ts` with escalation (`lib/services/escalation-service.ts`) and delegation (`ApprovalDelegate` model).

**Document Generation**: Template-based with field mapping. Templates stored in MinIO, generated documents support digital signatures.

**Form Components**: Large form files (`leave-request-form.tsx` ~33KB, `wfh-request-form.tsx` ~17KB) contain complex validation logic and conditional fields.

**Leave Balance**: Pro-rata calculations in `lib/services/pro-rata-service.ts`, year-end rollover in `lib/services/leave-rollover-service.ts`.

### Database Models (Prisma)
Core: `User`, `LeaveType`, `LeaveBalance`, `LeaveRequest`, `Approval`
WFH: `WorkFromHomeRequest`, `WFHApproval`, `WFHDocument`, `WFHSignature`
Documents: `DocumentTemplate`, `GeneratedDocument`, `DocumentSignature`
Planning: `HolidayPlanningWindow`, `HolidayPlan`, `Holiday`
Support: `Department`, `Position`, `AuditLog`, `Notification`, `ApprovalDelegate`

Roles enum: `EMPLOYEE`, `MANAGER`, `DEPARTMENT_DIRECTOR`, `HR`, `EXECUTIVE`, `ADMIN`

## Environment Variables

Required:
```env
DATABASE_URL="postgresql://user:password@host:port/database"
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID
SETUP_PASSWORD="admin-password"
```

Optional:
```env
REDIS_URL                    # Session cache
MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
RESEND_API_KEY, RESEND_FROM_EMAIL
SENTRY_DSN
SHOW_DEV_LOGIN="true"        # Enable dev credentials login
CRON_SECRET                  # Secure cron endpoints
```

## Production Deployment

Deployment is manual, directly on the production host:

```bash
# App-only redeploy (does not touch DB/MinIO/Redis containers)
docker compose -f docker-compose.production.yml up -d --build --no-deps app-production
```

On container start, `start.sh` runs `npx prisma migrate deploy` — pending migrations
are applied; schema drift fails loudly instead of being reconciled destructively.
Every schema change needs a hand-written migration under `prisma/migrations/`.

## Authentication Flow

1. User clicks "Sign in with Microsoft"
2. Azure AD authenticates and returns to `/api/auth/callback/azure-ad`
3. App checks if user email exists in database
4. If exists: grants access with role from database
5. If not: shows error to contact HR

Azure AD redirect URI must match exactly: `{NEXTAUTH_URL}/api/auth/callback/azure-ad`

## Build Configuration

TypeScript errors fail the build (`next.config.mjs` has `ignoreBuildErrors: false`); keep `npx tsc --noEmit` at 0 errors. ESLint is still skipped during builds but runs in CI. The `output: 'standalone'` setting optimizes for Docker.

## Quality Gates

- `npm run typecheck` — must stay at 0 errors (CI-blocking)
- `npm run lint` — CI-blocking
- `npm test` — vitest unit tests in `tests/unit/` covering lib/services business logic (CI-blocking)
- CI is `.github/workflows/ci.yml`; there is no CD — deploys are manual (see above)
