# Infrastructure Discovery Document

> Generated: 2026-02-01
> Purpose: Complete analysis of the Leave Management System for staging environment creation

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tech Stack Overview](#tech-stack-overview)
3. [Docker Services Map](#docker-services-map)
4. [Database Schema Overview](#database-schema-overview)
5. [Authentication Flow](#authentication-flow)
6. [Application Architecture](#application-architecture)
7. [Testing Infrastructure](#testing-infrastructure)
8. [Technical Debt & Issues](#technical-debt--issues)
9. [Staging Environment Recommendations](#staging-environment-recommendations)

---

## Executive Summary

The Leave Management System is a **Next.js 15** application with **App Router** architecture, using **PostgreSQL 15** for persistence, **Redis 7** for caching, and **MinIO** for S3-compatible object storage. Authentication is handled via **Azure AD SSO** with **NextAuth.js 4.24** using JWT strategy.

### Key Findings

- **No automated tests exist** - Zero test files found in the codebase
- **Single environment configuration** - Currently only UAT environment with hardcoded credentials
- **TypeScript/ESLint errors ignored** in builds (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`)
- **Database schema pushed directly** via `prisma db push --accept-data-loss` on startup
- **Development login enabled in production** via `SHOW_DEV_LOGIN=true`

---

## Tech Stack Overview

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.2.6 | Full-stack React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety (errors ignored in build) |
| Node.js | 18 (Alpine) | Runtime in Docker |

### Database & Storage

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 15 (Alpine) | Primary database |
| Prisma | 6.9.0 | ORM with migrations |
| Redis | 7 (Alpine) | Session cache, rate limiting |
| MinIO | Latest | S3-compatible document storage |

### Authentication & Security

| Technology | Version | Purpose |
|------------|---------|---------|
| NextAuth.js | 4.24.11 | Authentication framework |
| Azure AD Provider | Built-in | Microsoft SSO integration |
| JWT Strategy | - | Session management (NOT database sessions) |
| bcryptjs | 3.0.2 | Password hashing |

### UI & Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 3.4.17 | Utility-first CSS |
| shadcn/ui | Latest | Component library (Radix-based) |
| Lucide React | 0.454.0 | Icon library |
| react-hook-form | 7.54.1 | Form management |
| Zod | 3.24.1 | Schema validation |

### Document Processing

| Technology | Version | Purpose |
|------------|---------|---------|
| docxtemplater | 3.42.0 | DOCX template processing |
| pdf-lib | 1.17.1 | PDF generation/manipulation |
| react-pdf | 7.7.0 | PDF rendering |
| @react-pdf/renderer | 3.1.14 | PDF generation from React |

### External Services

| Technology | Purpose |
|------------|---------|
| Resend | Email notifications |
| Sentry | Error monitoring |
| Microsoft Graph Client | Azure AD integration |

---

## Docker Services Map

### Current docker-compose.yml (UAT)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Docker Network                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │      app        │    │       db        │    │      redis      │     │
│  │  (Next.js 15)   │    │  (PostgreSQL)   │    │   (Redis 7)     │     │
│  │                 │    │                 │    │                 │     │
│  │  Port: 9001:3000│    │  Port: 5481:5432│    │  Port: 6381:6379│     │
│  │                 │    │                 │    │                 │     │
│  │  Depends on:    │    │  Volume:        │    │  Volume:        │     │
│  │  - db           │────│  uat_postgres_  │    │  uat_redis_     │     │
│  │  - redis        │    │  data           │    │  data           │     │
│  │  - minio        │    │                 │    │                 │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│           │                                                              │
│           │                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                            │
│  │      minio      │    │     adminer     │                            │
│  │  (Object Store) │    │  (DB Admin UI)  │                            │
│  │                 │    │                 │                            │
│  │  API: 9101:9000 │    │  Port: 8181:8080│                            │
│  │  Console:       │    │                 │                            │
│  │  9102:9001      │    │  Depends on: db │                            │
│  │                 │    │                 │                            │
│  │  Volume:        │    │                 │                            │
│  │  uat_minio_data │    │                 │                            │
│  └─────────────────┘    └─────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Service Details

#### 1. App Service (Next.js)

| Property | Value |
|----------|-------|
| Image | Custom (node:18-alpine based) |
| External Port | 9001 |
| Internal Port | 3000 |
| Health Check | None configured |
| Restart Policy | unless-stopped |

**Environment Variables:**
```
APP_ENV=uat
APP_NAME=Leave Management (UAT)
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@db:5432/leave_uat
REDIS_URL=redis://redis:6379
NEXTAUTH_URL=https://lms.tpfing.ro
NEXTAUTH_SECRET=<hardcoded-secret>
AZURE_AD_CLIENT_ID=<azure-client-id>
AZURE_AD_CLIENT_SECRET=<azure-secret>
AZURE_AD_TENANT_ID=<azure-tenant>
SETUP_PASSWORD=admin123
CRON_SECRET=<cron-secret>
SHOW_DEV_LOGIN=true
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=leave-management-uat
RESEND_API_KEY=<resend-key>
RESEND_FROM_EMAIL=lms@testing.tpfing.ro
RESEND_FROM_NAME="TPF - LMS"
```

#### 2. Database Service (PostgreSQL)

| Property | Value |
|----------|-------|
| Image | postgres:15-alpine |
| External Port | 5481 |
| Internal Port | 5432 |
| Volume | uat_postgres_data:/var/lib/postgresql/data |
| Health Check | pg_isready -U postgres (10s interval) |
| Restart Policy | unless-stopped |

**Environment Variables:**
```
POSTGRES_DB=leave_uat
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
```

#### 3. Redis Service

| Property | Value |
|----------|-------|
| Image | redis:7-alpine |
| External Port | 6381 |
| Internal Port | 6379 |
| Volume | uat_redis_data:/data |
| Health Check | redis-cli ping (10s interval) |
| Restart Policy | unless-stopped |

#### 4. MinIO Service (Object Storage)

| Property | Value |
|----------|-------|
| Image | minio/minio:latest |
| API Port | 9101:9000 |
| Console Port | 9102:9001 |
| Volume | uat_minio_data:/data |
| Health Check | curl localhost:9000/minio/health/live (30s interval) |
| Restart Policy | unless-stopped |

**Environment Variables:**
```
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
```

#### 5. Adminer Service (Database Admin)

| Property | Value |
|----------|-------|
| Image | adminer:latest |
| External Port | 8181 |
| Internal Port | 8080 |
| Depends On | db |
| Restart Policy | unless-stopped |

### Named Volumes

- `uat_postgres_data` - PostgreSQL persistent storage
- `uat_redis_data` - Redis persistent storage
- `uat_minio_data` - MinIO object storage

---

## Database Schema Overview

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE ENTITIES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐         ┌─────────────────┐         ┌───────────────┐  │
│  │   Department   │         │      User       │         │   Position    │  │
│  │   (Reference)  │         │    (Central)    │         │  (Reference)  │  │
│  └────────────────┘         │                 │         └───────────────┘  │
│                             │ - email (unique)│                            │
│                             │ - employeeId    │                            │
│                             │ - role (enum)   │                            │
│                             │ - managerId  ───┼──┐ (self-reference)        │
│                             │ - deptDirector  │  │                          │
│                             └────────┬────────┘  │                          │
│                                      │ ◄─────────┘                          │
│                                      │                                       │
├──────────────────────────────────────┼───────────────────────────────────────┤
│                              LEAVE MANAGEMENT                                │
├──────────────────────────────────────┼───────────────────────────────────────┤
│                                      │                                       │
│  ┌────────────────┐         ┌────────┴────────┐         ┌───────────────┐  │
│  │   LeaveType    │◄────────│  LeaveRequest   │────────►│   Approval    │  │
│  │                │         │                 │         │               │  │
│  │ - Annual Leave │         │ - status (enum) │         │ - level       │  │
│  │ - Sick Leave   │         │ - totalDays     │         │ - status      │  │
│  │ - Paternity    │         │ - selectedDates │         │ - comments    │  │
│  └────────────────┘         └────────┬────────┘         │ - signature   │  │
│         │                            │                  └───────────────┘  │
│         │                            │                                       │
│         ▼                            ▼                                       │
│  ┌────────────────┐         ┌─────────────────┐         ┌───────────────┐  │
│  │  LeaveBalance  │         │    Comment      │         │  Notification │  │
│  │                │         │                 │         │               │  │
│  │ - entitled     │         │ - text          │         │ - type (enum) │  │
│  │ - used         │         │ - isInternal    │         │ - isRead      │  │
│  │ - available    │         └─────────────────┘         └───────────────┘  │
│  └────────────────┘                                                         │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                              WFH MANAGEMENT                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  WorkFromHomeRequest   │───►│   WFHApproval   │    │   WFHDocument   │  │
│  │                        │    │                 │    │                 │  │
│  │  - selectedDates (JSON)│    │ - status        │    │ - pdfData       │  │
│  │  - location            │    │ - comments      │    │ - status        │  │
│  │  - totalDays           │    └─────────────────┘    └────────┬────────┘  │
│  └────────────────────────┘                                    │           │
│                                                                 ▼           │
│                                                          ┌─────────────────┐│
│                                                          │  WFHSignature   ││
│                                                          │ - signatureData ││
│                                                          └─────────────────┘│
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                           DOCUMENT MANAGEMENT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐    ┌─────────────────────┐    ┌──────────────────┐ │
│  │  DocumentTemplate  │───►│  GeneratedDocument  │───►│ DocumentSignature│ │
│  │                    │    │                     │    │                  │ │
│  │  - fileUrl         │    │ - templateSnapshot  │    │ - signatureData  │ │
│  │  - category        │    │ - decisions (JSON)  │    │ - signerRole     │ │
│  └──────────┬─────────┘    └─────────────────────┘    └──────────────────┘ │
│             │                                                                │
│             ▼                                                                │
│  ┌────────────────────┐    ┌─────────────────────┐                          │
│  │TemplateFieldMapping│    │  TemplateSignature  │                          │
│  │ - fieldKey         │    │  - signerRole       │                          │
│  │ - documentPosition │    │  - documentPosition │                          │
│  └────────────────────┘    └─────────────────────┘                          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                           HOLIDAY PLANNING                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐    ┌─────────────────┐    ┌───────────────────┐  │
│  │ HolidayPlanningWindow│───►│   HolidayPlan   │───►│  HolidayPlanDate  │  │
│  │                      │    │                 │    │                   │  │
│  │  - year (unique)     │    │ - status (enum) │    │ - date            │  │
│  │  - stage (enum)      │    │ - version       │    │ - priority (enum) │  │
│  │  - openDate/closeDate│    └─────────────────┘    └───────────────────┘  │
│  └──────────────────────┘                                                   │
│                                                                              │
│  ┌────────────────┐                                                         │
│  │    Holiday     │  (Public holidays - Romania)                            │
│  │  - nameEn/Ro   │                                                         │
│  │  - isBlocked   │                                                         │
│  └────────────────┘                                                         │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                              SYSTEM TABLES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐    ┌─────────────────┐    ┌────────────────────────┐   │
│  │ CompanySetting │    │    AuditLog     │    │   ApprovalDelegate     │   │
│  │  - key (unique)│    │  - action       │    │  - delegatorId         │   │
│  │  - value (JSON)│    │  - entity       │    │  - delegateId          │   │
│  │  - category    │    │  - oldValues    │    │  - startDate/endDate   │   │
│  └────────────────┘    │  - newValues    │    └────────────────────────┘   │
│                        └─────────────────┘                                  │
│                                                                              │
│  ┌──────────────────────┐                                                   │
│  │    WorkflowRule      │                                                   │
│  │  - conditions (JSON) │                                                   │
│  │  - approvalLevels    │                                                   │
│  │  - priority          │                                                   │
│  └──────────────────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Enums

```typescript
enum Role {
  EMPLOYEE
  MANAGER
  DEPARTMENT_DIRECTOR
  HR
  EXECUTIVE
  ADMIN
}

enum RequestStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum DocumentStatus {
  DRAFT
  PENDING_SIGNATURES
  COMPLETED
}

enum PlanningStage {
  CLOSED
  DRAFT          // Oct 1-15
  SUBMISSION     // Oct 16-Nov 30
  COORDINATION   // Dec 1-15
  FINALIZATION   // Dec 16-31
  LOCKED         // Jan 1+
}

enum PlanStatus {
  DRAFT
  SUBMITTED
  REVIEWED
  FINALIZED
  LOCKED
}

enum PlanPriority {
  ESSENTIAL
  PREFERRED
  NICE_TO_HAVE
}

enum WorkingPattern {
  FULL_TIME
  PART_TIME
  COMPRESSED_HOURS
  JOB_SHARE
}

enum ContractType {
  PERMANENT
  FIXED_TERM
  CASUAL
  CONTRACTOR
  INTERN
}

enum NotificationType {
  LEAVE_REQUESTED
  LEAVE_APPROVED
  LEAVE_REJECTED
  LEAVE_CANCELLED
  APPROVAL_REQUIRED
  DOCUMENT_READY
}
```

### Key Relationships

1. **User Self-References**
   - `managerId` -> User (manager relationship)
   - `departmentDirectorId` -> User (director relationship)

2. **Leave Request Chain**
   - User -> LeaveRequest -> Approval (multi-level)
   - LeaveRequest -> GeneratedDocument -> DocumentSignature

3. **Holiday Planning**
   - HolidayPlanningWindow -> HolidayPlan -> HolidayPlanDate

### Database Migrations

Located in `prisma/migrations/`:

| Migration | Description |
|-----------|-------------|
| 20241117_add_part_time_support | Part-time employee support |
| 20241117_add_performance_indexes | Database performance indexes |
| 20251016_add_missing_fields | Missing fields (entityType, details on AuditLog) |
| 20251022090614_add_reason_to_approval_delegate | Reason field for delegation |

### Seeding Approach

- No dedicated seed file exists (`prisma/seed.ts` not found)
- Initial data appears to be created through the application
- Users must exist in database before Azure AD SSO login

---

## Authentication Flow

### Authentication Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION FLOW                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌─────────────┐                      ┌─────────────────────────────┐   │
│   │   Browser   │                      │         Azure AD            │   │
│   │             │                      │                             │   │
│   │  User clicks│                      │  - Tenant: configured       │   │
│   │  "Sign in   │─────────────────────►│  - Client ID: configured    │   │
│   │   with MS"  │      OAuth2 Flow     │  - Scopes: openid, email,   │   │
│   │             │◄─────────────────────│    profile, User.Read       │   │
│   └──────┬──────┘    Return with code  │                             │   │
│          │                             └─────────────────────────────┘   │
│          │                                                                │
│          ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │                    NextAuth.js (v4.24)                          │    │
│   │                                                                  │    │
│   │  ┌─────────────────────────────────────────────────────────┐    │    │
│   │  │              PROVIDERS                                   │    │    │
│   │  │                                                          │    │    │
│   │  │  1. Azure AD Provider (Production)                       │    │    │
│   │  │     - Standard OAuth2 flow                               │    │    │
│   │  │     - User must exist in database                        │    │    │
│   │  │                                                          │    │    │
│   │  │  2. Credentials Provider (Dev/UAT only)                  │    │    │
│   │  │     - Enabled by SHOW_DEV_LOGIN=true                     │    │    │
│   │  │     - Can select existing users from DB                  │    │    │
│   │  │     - Can create mock users with any role                │    │    │
│   │  └─────────────────────────────────────────────────────────┘    │    │
│   │                                                                  │    │
│   │  ┌─────────────────────────────────────────────────────────┐    │    │
│   │  │              CALLBACKS                                   │    │    │
│   │  │                                                          │    │    │
│   │  │  signIn: Check user exists in DB (Azure AD only)         │    │    │
│   │  │  jwt:    Fetch role/department from DB, add to token     │    │    │
│   │  │  session: Expose user.id, role, department to client     │    │    │
│   │  └─────────────────────────────────────────────────────────┘    │    │
│   │                                                                  │    │
│   │  Session Strategy: JWT (NOT database sessions)                   │    │
│   │  Custom Pages: /login (signIn), /login (error)                   │    │
│   │                                                                  │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│          │                                                                │
│          ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │                     MIDDLEWARE                                   │    │
│   │                  (middleware.ts)                                 │    │
│   │                                                                  │    │
│   │  Security Headers:                                               │    │
│   │  - X-Content-Type-Options: nosniff                               │    │
│   │  - X-Frame-Options: DENY                                         │    │
│   │  - X-XSS-Protection: 1; mode=block                               │    │
│   │  - Referrer-Policy: strict-origin-when-cross-origin              │    │
│   │                                                                  │    │
│   │  Public Paths (no auth required):                                │    │
│   │  - /login, /api/auth/*, /api/setup/*, /api/dev/*                 │    │
│   │  - /setup, /_next/*, /static/*, /favicon.ico                     │    │
│   │                                                                  │    │
│   │  Role-Based Route Protection:                                    │    │
│   │  - /hr/*       : HR, EXECUTIVE, ADMIN, or HR department employee │    │
│   │  - /manager/*  : MANAGER, DEPARTMENT_DIRECTOR, HR, EXECUTIVE,    │    │
│   │                  ADMIN                                           │    │
│   │  - /executive/*: EXECUTIVE, ADMIN only                           │    │
│   │  - /admin/*    : ADMIN only                                      │    │
│   │                                                                  │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Session Contents

```typescript
interface Session {
  user: {
    id: string;           // Database user ID
    email: string;        // From Azure AD
    name: string;         // Full name
    role: Role;           // From database
    department: string;   // From database
    firstName: string;    // From database
    lastName: string;     // From database
    image?: string;       // From Azure AD (optional)
  }
}
```

### Security Considerations

1. **JWT Strategy** - Sessions stored in signed JWT tokens, NOT in database
2. **User Pre-registration Required** - Users must exist in database before SSO login
3. **Development Login Exposure** - `SHOW_DEV_LOGIN=true` allows bypassing Azure AD
4. **No Adapter Used** - PrismaAdapter deliberately NOT used (incompatible with JWT)

---

## Test Authentication (CI/CD)

### Overview

A dedicated test authentication endpoint (`/api/test-auth`) enables automated testing and CI/CD pipelines to authenticate programmatically without manual intervention. This system is designed with multiple security layers to ensure it **never operates in production**.

### Security Controls

| Control | Description |
|---------|-------------|
| Environment Check | Only enabled when `APP_ENV=staging` |
| Secret Required | Requires `TEST_AUTH_SECRET` environment variable |
| Production Block | Explicitly blocked when `NODE_ENV=production` without `APP_ENV=staging` |
| Secret Validation | Uses constant-time comparison to prevent timing attacks |
| Audit Logging | All authentication attempts are logged with IP address |

### Environment Variables

```env
# Required for test authentication (STAGING ONLY)
APP_ENV=staging                           # Must be "staging"
TEST_AUTH_SECRET="<generate-with-openssl-rand-base64-32>"
```

### API Endpoints

#### GET /api/test-auth

Returns available test users and usage information.

**Headers:**
```
x-test-auth-secret: <your-test-auth-secret>
```

**Response:**
```json
{
  "enabled": true,
  "authenticated": true,
  "availableRoles": ["EMPLOYEE", "MANAGER", "DEPARTMENT_DIRECTOR", "HR", "EXECUTIVE", "ADMIN"],
  "usersByRole": {
    "ADMIN": [{ "id": "...", "email": "...", "role": "ADMIN" }],
    "EMPLOYEE": [...]
  },
  "totalUsers": 50,
  "usage": {
    "authenticate": "POST /api/test-auth with { userId: string } or { email: string } or { role: string }",
    "headers": "x-test-auth-secret: <your-secret>"
  }
}
```

#### POST /api/test-auth

Authenticate as a specific user and receive a session token.

**Headers:**
```
x-test-auth-secret: <your-test-auth-secret>
Content-Type: application/json
```

**Request Body Options:**
```json
// Option 1: By user ID
{ "userId": "user-uuid-here" }

// Option 2: By email
{ "email": "user@example.com" }

// Option 3: By role (returns first user with that role)
{ "role": "ADMIN" }
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "ADMIN",
    "department": "IT",
    "firstName": "John",
    "lastName": "Doe"
  },
  "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
  "cookie": {
    "name": "next-auth.session-token",
    "value": "eyJhbGciOiJIUzI1NiIs...",
    "options": {
      "httpOnly": true,
      "secure": false,
      "sameSite": "lax",
      "path": "/",
      "maxAge": 86400
    }
  }
}
```

### Usage Examples

#### cURL - Authenticate as Admin

```bash
# Get available users
curl -X GET http://localhost:8082/api/test-auth \
  -H "x-test-auth-secret: your-secret-here"

# Authenticate as admin
curl -X POST http://localhost:8082/api/test-auth \
  -H "x-test-auth-secret: your-secret-here" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}' \
  -c cookies.txt

# Make authenticated request using cookie
curl http://localhost:8082/api/admin/users \
  -b cookies.txt
```

#### Playwright Test Example

```typescript
import { test, expect } from '@playwright/test';

const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET;
const BASE_URL = process.env.BASE_URL || 'http://localhost:8082';

async function authenticateAs(role: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/test-auth`, {
    method: 'POST',
    headers: {
      'x-test-auth-secret': TEST_AUTH_SECRET!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  });

  const data = await response.json();
  return data.sessionToken;
}

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ context }) => {
    const token = await authenticateAs('ADMIN');
    await context.addCookies([{
      name: 'next-auth.session-token',
      value: token,
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('can access admin dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('Admin');
  });
});
```

#### Node.js/Vitest Example

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET;
const BASE_URL = process.env.BASE_URL || 'http://localhost:8082';

describe('API Tests', () => {
  let adminToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    // Authenticate as different roles
    const adminAuth = await fetch(`${BASE_URL}/api/test-auth`, {
      method: 'POST',
      headers: {
        'x-test-auth-secret': TEST_AUTH_SECRET!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'ADMIN' }),
    });
    const adminData = await adminAuth.json();
    adminToken = adminData.sessionToken;

    const employeeAuth = await fetch(`${BASE_URL}/api/test-auth`, {
      method: 'POST',
      headers: {
        'x-test-auth-secret': TEST_AUTH_SECRET!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'EMPLOYEE' }),
    });
    const employeeData = await employeeAuth.json();
    employeeToken = employeeData.sessionToken;
  });

  it('admin can access admin endpoints', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: {
        'Cookie': `next-auth.session-token=${adminToken}`,
      },
    });
    expect(response.ok).toBe(true);
  });

  it('employee cannot access admin endpoints', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: {
        'Cookie': `next-auth.session-token=${employeeToken}`,
      },
    });
    expect(response.status).toBe(403);
  });
});
```

### Security Verification

To verify test authentication cannot leak to production:

```bash
# In production environment (should fail)
APP_ENV=production curl -X POST http://localhost:3000/api/test-auth \
  -H "x-test-auth-secret: any-secret" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'

# Expected response:
# {"error":"Test authentication not available","reason":"Test authentication only available in staging environment (APP_ENV=staging)"}
```

### CI/CD Pipeline Integration

Example GitHub Actions workflow:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      staging:
        image: leave-management:staging
        env:
          APP_ENV: staging
          TEST_AUTH_SECRET: ${{ secrets.TEST_AUTH_SECRET }}
          # ... other env vars

    steps:
      - uses: actions/checkout@v4

      - name: Run E2E Tests
        env:
          TEST_AUTH_SECRET: ${{ secrets.TEST_AUTH_SECRET }}
          BASE_URL: http://localhost:8082
        run: pnpm test:e2e
```

---

## Application Architecture

### Folder Structure

```
leave/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── admin/                # Admin endpoints (30 subdirs)
│   │   ├── analytics/            # Analytics data
│   │   ├── auth/                 # NextAuth endpoints
│   │   ├── calendar/             # Calendar data
│   │   ├── cron/                 # Scheduled jobs
│   │   ├── documents/            # Document management
│   │   ├── employee/             # Employee endpoints
│   │   ├── escalation/           # Approval escalation
│   │   ├── executive/            # Executive endpoints
│   │   ├── holiday-planning/     # Holiday planning API
│   │   ├── hr/                   # HR endpoints
│   │   ├── leave-requests/       # Leave CRUD
│   │   ├── manager/              # Manager endpoints
│   │   ├── notifications/        # Notification system
│   │   ├── setup/                # Initial setup
│   │   ├── user/                 # User management
│   │   └── wfh-requests/         # WFH management
│   ├── admin/                    # Admin dashboard
│   ├── employee/                 # Employee dashboard
│   ├── executive/                # Executive dashboard
│   ├── holiday-planning/         # Holiday planning UI
│   ├── hr/                       # HR dashboard
│   ├── leave-requests/           # Leave request UI
│   ├── login/                    # Login page
│   ├── manager/                  # Manager dashboard
│   ├── setup/                    # Setup wizard
│   ├── team-calendar/            # Team calendar view
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page (redirects by role)
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── admin/                    # Admin-specific components
│   ├── hr/                       # HR-specific components
│   ├── manager/                  # Manager components
│   ├── mobile/                   # Mobile-responsive components
│   ├── documents/                # Document components
│   ├── leave-request-form.tsx    # 33KB - Complex leave form
│   ├── wfh-request-form.tsx      # 17KB - WFH request form
│   └── ...                       # Other components
├── lib/                          # Utilities & Services
│   ├── services/                 # Business logic
│   │   ├── workflow-engine.ts    # Approval workflows
│   │   ├── escalation-service.ts # Approval escalation
│   │   ├── leave-balance-service.ts
│   │   ├── pro-rata-service.ts
│   │   ├── holiday-planning.ts
│   │   └── ...
│   ├── cache/                    # Redis cache utilities
│   ├── middleware/               # API middleware
│   ├── validators/               # Validation schemas
│   ├── auth-config.ts            # NextAuth configuration
│   ├── auth.ts                   # Auth helpers
│   ├── email-service.ts          # 42KB - Email templates
│   ├── prisma.ts                 # Prisma client singleton
│   ├── minio.ts                  # MinIO client
│   └── ...
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Migration files
├── public/                       # Static assets
├── scripts/                      # Utility scripts
│   ├── db-reset-safe.js          # Safe DB reset
│   └── ...
├── types/                        # TypeScript types
├── config/                       # Configuration files
├── docs/                         # Documentation
├── docker-compose.yml            # UAT Docker config
├── docker-compose.uat.yml        # UAT template
├── Dockerfile                    # Production Dockerfile
├── middleware.ts                 # Next.js middleware
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies
├── tailwind.config.ts            # Tailwind configuration
└── tsconfig.json                 # TypeScript configuration
```

### Key Services

| Service | File | Purpose |
|---------|------|---------|
| Workflow Engine | `lib/services/workflow-engine.ts` | Multi-level approval workflows |
| Escalation | `lib/services/escalation-service.ts` | Auto-escalation on timeout |
| Leave Balance | `lib/services/leave-balance-service.ts` | Balance calculations |
| Pro-Rata | `lib/services/pro-rata-service.ts` | Part-time calculations |
| Holiday Planning | `lib/services/holiday-planning.ts` | Annual planning workflows |
| Document Generator | `lib/smart-document-generator.ts` | DOCX/PDF generation |
| Email Service | `lib/email-service.ts` | Email notifications (42KB) |
| Cache Service | `lib/services/cache-service.ts` | Redis caching |
| Audit Service | `lib/services/audit-service.ts` | Audit logging |

### Route Structure

| Route | Role | Purpose |
|-------|------|---------|
| `/` | All | Redirects to role-appropriate dashboard |
| `/employee` | All | Personal leave/WFH requests, balances |
| `/manager` | MANAGER+ | Team approvals, substitution |
| `/hr` | HR/EXECUTIVE/ADMIN | User management, policies, reports |
| `/executive` | EXECUTIVE/ADMIN | Company-wide analytics |
| `/admin` | ADMIN | System configuration |
| `/setup` | Public | Initial Azure AD setup |
| `/login` | Public | Authentication |
| `/holiday-planning` | All | Annual holiday planning |
| `/team-calendar` | All | Team calendar view |

---

## Testing Infrastructure

### Current State

**No automated tests exist in the codebase.**

- Zero `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` files found
- No test framework configured (no Jest, Vitest, Playwright, Cypress)
- No `__tests__` directories
- No test scripts in `package.json`

### Build Configuration

From `next.config.mjs`:

```javascript
{
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,  // ESLint errors ignored
  },
  typescript: {
    ignoreBuildErrors: true,   // TS errors ignored
  },
  images: {
    unoptimized: true,
  },
}
```

This means builds will succeed even with:
- TypeScript type errors
- ESLint violations
- Unoptimized images

---

## Technical Debt & Issues

### Critical Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| No Tests | Critical | Zero automated tests - no safety net for changes |
| Build Errors Ignored | High | TypeScript/ESLint errors masked |
| Dev Login in Production | High | `SHOW_DEV_LOGIN=true` allows auth bypass |
| Hardcoded Credentials | High | Secrets in docker-compose.yml |
| Schema Push on Startup | Medium | `prisma db push --accept-data-loss` runs every container start |
| No Health Check for App | Medium | App container has no health check |

### Security Concerns

1. **Exposed Development Login** - Credentials provider enabled in UAT
2. **Weak Default Passwords** - `SETUP_PASSWORD=admin123`, `POSTGRES_PASSWORD=password`
3. **Secrets in Version Control** - Azure AD secrets visible in docker-compose.yml
4. **Missing CSP Headers** - No Content-Security-Policy header set

### Code Quality Issues

1. **Large Component Files**
   - `leave-request-form.tsx`: 33KB
   - `email-service.ts`: 42KB
   - `smart-document-generator.ts`: 38KB

2. **No Seed File** - Initial data must be created manually

3. **Mixed Environment Configuration** - UAT-specific values hardcoded

### Missing Infrastructure

- No staging environment
- No CI/CD pipeline visible
- No database backup strategy documented
- No logging aggregation
- No metrics/monitoring (beyond Sentry)

---

## Staging Environment Recommendations

### Environment Separation Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED ENVIRONMENT SETUP                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  DEVELOPMENT              STAGING                 PRODUCTION (UAT)       │
│  (Local)                  (New)                   (Current)              │
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │ Local Next  │         │ Docker App  │         │ Docker App  │        │
│  │ pnpm dev    │         │ Port: 9002  │         │ Port: 9001  │        │
│  └─────────────┘         └─────────────┘         └─────────────┘        │
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │ Local PG    │         │ PostgreSQL  │         │ PostgreSQL  │        │
│  │ Port: 5432  │         │ Port: 5482  │         │ Port: 5481  │        │
│  └─────────────┘         └─────────────┘         └─────────────┘        │
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │ Local Redis │         │ Redis       │         │ Redis       │        │
│  │ Port: 6379  │         │ Port: 6382  │         │ Port: 6381  │        │
│  └─────────────┘         └─────────────┘         └─────────────┘        │
│                                                                          │
│  SHOW_DEV_LOGIN=true     SHOW_DEV_LOGIN=true     SHOW_DEV_LOGIN=false   │
│                                                   (recommended)          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Changes

#### 1. Create docker-compose.staging.yml

- Use different port mappings (9002, 5482, 6382, 9103, 9104, 8182)
- Separate volume names (`staging_*` instead of `uat_*`)
- Use environment-specific database (`leave_staging`)
- Different Azure AD app registration (staging callback URL)

#### 2. Environment Variable Management

- Move secrets to `.env` files (not version controlled)
- Use `.env.staging` and `.env.production` templates
- Remove hardcoded credentials from docker-compose files

#### 3. Database Strategy

- Create seed script for consistent test data
- Replace `prisma db push --accept-data-loss` with proper migrations
- Add backup/restore scripts

#### 4. Testing Setup

- Add Vitest for unit/integration tests
- Add Playwright for E2E tests
- Configure test database
- Add `pnpm test` and `pnpm test:e2e` scripts

#### 5. Build Pipeline

- Enable TypeScript strict checking (`ignoreBuildErrors: false`)
- Enable ESLint during builds
- Add pre-commit hooks (Husky + lint-staged)

#### 6. Security Improvements

- Disable `SHOW_DEV_LOGIN` in production
- Use secrets manager for Azure AD credentials
- Add Content-Security-Policy header
- Implement rate limiting on auth endpoints

### Staging Environment Files Needed

```
docker-compose.staging.yml    # New Docker compose for staging
.env.staging.example          # Template for staging secrets
scripts/seed-staging.ts       # Seed script for test data
scripts/backup-staging.sh     # Database backup script
```

### Port Mapping Recommendation

| Service | Development | Staging | Production (UAT) |
|---------|-------------|---------|------------------|
| App | 3000 | 9002 | 9001 |
| PostgreSQL | 5432 | 5482 | 5481 |
| Redis | 6379 | 6382 | 6381 |
| MinIO API | 9000 | 9103 | 9101 |
| MinIO Console | 9001 | 9104 | 9102 |
| Adminer | 8080 | 8182 | 8181 |

---

## Appendix: Quick Reference

### Useful Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build production
pnpm lint                   # Run linter

# Database
pnpm db:up                  # Start Docker services
pnpm db:down                # Stop Docker services
pnpm db:migrate             # Run migrations
pnpm db:studio              # Open Prisma Studio
npx prisma db push          # Push schema changes (dev only)

# Docker
docker-compose up -d        # Start all services
docker-compose logs -f app  # Follow app logs
docker-compose down -v      # Stop and remove volumes (DESTRUCTIVE)
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Current UAT environment |
| `Dockerfile` | Production container build |
| `start.sh` | Container startup script |
| `middleware.ts` | Auth & security middleware |
| `next.config.mjs` | Next.js configuration |
| `prisma/schema.prisma` | Database schema |
| `lib/auth-config.ts` | NextAuth configuration |
| `.env.example` | Environment variables template |

### Default Credentials (UAT - Change in Production!)

| Service | Username | Password |
|---------|----------|----------|
| PostgreSQL | postgres | password |
| MinIO | minioadmin | minioadmin123 |
| Setup Page | - | admin123 |
