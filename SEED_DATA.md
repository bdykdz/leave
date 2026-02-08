# Staging Seed Data Documentation

> Generated: 2026-02-01
> Script: `prisma/seed.ts`
> Command: `pnpm db:seed`

This document describes the comprehensive seed data created for the staging environment to enable testing of all user roles and scenarios.

## Table of Contents

1. [Quick Start](#quick-start)
2. [User Accounts](#user-accounts)
3. [Organizational Structure](#organizational-structure)
4. [Leave Types](#leave-types)
5. [Historical Leave Requests](#historical-leave-requests)
6. [Company Settings](#company-settings)
7. [Edge Cases & Special Scenarios](#edge-cases--special-scenarios)
8. [Testing Scenarios](#testing-scenarios)

---

## Quick Start

### Running the Seed Script

```bash
# Full database setup (start containers, migrate, seed)
pnpm db:setup

# Or run seed separately
pnpm db:seed

# For staging environment with Docker
docker-compose -f docker-compose.staging.yml exec app pnpm db:seed
```

### Default Credentials

| Property | Value |
|----------|-------|
| Password (all users) | `password123` |
| Email format | `[role]@staging.local` |
| Dev login | Enabled via `SHOW_DEV_LOGIN=true` |

### Idempotency

The seed script is **idempotent** - it can be run multiple times without creating duplicate data. It uses `upsert` operations to safely update or create records.

---

## User Accounts

### Summary

| Role | Count | Description |
|------|-------|-------------|
| EXECUTIVE | 3 | C-level executives (CEO, CTO, CFO) |
| ADMIN | 2 | System administrators |
| HR | 3 | HR Manager + 2 specialists |
| DEPARTMENT_DIRECTOR | 3 | Engineering, Finance, Sales directors |
| MANAGER | 4 | Team managers |
| EMPLOYEE | 12 | Regular employees (various types) |
| **Total** | **27** | Including 1 inactive employee |

### Executive Users

| Email | Name | Position | Reports To |
|-------|------|----------|------------|
| `ceo@staging.local` | Maria Popescu | CEO | - |
| `cto@staging.local` | Alexandru Ionescu | CTO | CEO |
| `cfo@staging.local` | Elena Dumitrescu | CFO | CEO |

### Admin Users

| Email | Name | Position |
|-------|------|----------|
| `admin@staging.local` | System Administrator | System Administrator |
| `admin2@staging.local` | Backup Admin | System Administrator |

### HR Users

| Email | Name | Position | Reports To |
|-------|------|----------|------------|
| `hr.manager@staging.local` | Diana Vasilescu | HR Manager | CEO |
| `hr1@staging.local` | Ioana Stanescu | HR Specialist | HR Manager |
| `hr2@staging.local` | Andreea Moldovan | HR Specialist | HR Manager |

### Department Directors

| Email | Name | Department | Reports To |
|-------|------|------------|------------|
| `eng.director@staging.local` | Bogdan Cristea | Engineering | CTO |
| `fin.director@staging.local` | Catalin Marinescu | Finance | CFO |
| `sales.director@staging.local` | Mihai Gheorghiu | Sales | CEO |

### Managers

| Email | Name | Department | Reports To |
|-------|------|------------|------------|
| `eng.manager1@staging.local` | Razvan Popa | Engineering | Eng Director |
| `eng.manager2@staging.local` | Florin Diaconu | Engineering | Eng Director |
| `fin.manager@staging.local` | Adriana Radu | Finance | Fin Director |
| `sales.manager@staging.local` | Cristian Negru | Sales | Sales Director |

### Employees

| Email | Name | Department | Manager | Special |
|-------|------|------------|---------|---------|
| `dev1@staging.local` | Andrei Stoica | Engineering | Eng Manager 1 | - |
| `dev2@staging.local` | Vlad Barbu | Engineering | Eng Manager 1 | - |
| `dev3@staging.local` | George Munteanu | Engineering | Eng Manager 1 | - |
| `dev4@staging.local` | Stefan Lazar | Engineering | Eng Manager 2 | - |
| `dev5@staging.local` | Ana Serban | Engineering | Eng Manager 2 | - |
| `fin1@staging.local` | Larisa Preda | Finance | Fin Manager | - |
| `fin2@staging.local` | Oana Ene | Finance | Fin Manager | - |
| `sales1@staging.local` | Marius Tudor | Sales | Sales Manager | - |
| `sales2@staging.local` | Roxana Voicu | Sales | Sales Manager | - |
| `parttime@staging.local` | Iulia Coman | Engineering | Eng Manager 1 | Part-time (3 days/week) |
| `intern@staging.local` | Cosmin Mihai | Engineering | Eng Manager 2 | Intern contract |
| `inactive@staging.local` | Former Employee | Engineering | - | **Inactive** |

---

## Organizational Structure

```
CEO (Maria Popescu)
├── CTO (Alexandru Ionescu)
│   └── Engineering Director (Bogdan Cristea)
│       ├── Engineering Manager 1 (Razvan Popa)
│       │   ├── Andrei Stoica (Sr. Dev)
│       │   ├── Vlad Barbu (Jr. Dev)
│       │   ├── George Munteanu (Sr. Dev)
│       │   ├── Iulia Coman (Jr. Dev, Part-time)
│       │   └── [Inactive] Former Employee
│       └── Engineering Manager 2 (Florin Diaconu)
│           ├── Stefan Lazar (Sr. Dev)
│           ├── Ana Serban (Jr. Dev)
│           └── Cosmin Mihai (Jr. Dev, Intern)
│
├── CFO (Elena Dumitrescu)
│   └── Finance Director (Catalin Marinescu)
│       └── Finance Manager (Adriana Radu)
│           ├── Larisa Preda (Analyst)
│           └── Oana Ene (Analyst)
│
├── Sales Director (Mihai Gheorghiu)
│   └── Sales Manager (Cristian Negru)
│       ├── Marius Tudor (Sales Rep)
│       └── Roxana Voicu (Sales Rep)
│
└── HR Manager (Diana Vasilescu)
    ├── Ioana Stanescu (HR Specialist)
    └── Andreea Moldovan (HR Specialist)
```

### Departments

| Code | Name | Description |
|------|------|-------------|
| ENG | Engineering | Software Development |
| HR | Human Resources | HR Department |
| FIN | Finance | Finance and Accounting |
| SALES | Sales | Sales and Business Development |
| MKT | Marketing | Marketing and Communications |
| OPS | Operations | Operations and Infrastructure |
| EXEC | Executive Office | Executive Leadership |
| IT | IT Support | IT Support and Infrastructure |

---

## Leave Types

| Code | Name | Days Allowed | Carry Forward | Requires Document | HR Verification |
|------|------|--------------|---------------|-------------------|-----------------|
| NL | Normal Leave | 21 | Yes (max 5) | No | No |
| SL | Sick Leave | 180 | No | Yes | Yes |
| PAT | Paternity Leave | 5 | No | Yes | Yes |
| MAT | Maternity Leave | 126 | No | Yes | Yes |
| MARR | Marriage Leave | 5 | No | Yes | Yes |
| BER | Bereavement Leave | 3 | No | Yes | Yes |
| STD | Study Leave | 10 | No | Yes | No |
| UPL | Unpaid Leave | 30 | No | No | Yes |
| CCL | Child Care Leave | 2 | No | No | No |
| BDL | Blood Donation Leave | 1 | No | Yes | No |

### Special Leave Notes

- **Normal Leave (NL)**: Only leave type that tracks balance. Max 14 days per request.
- **Sick Leave (SL)**: Requires medical certificate. Up to 180 days per year.
- **Maternity/Paternity**: Requires birth certificate.
- **Marriage**: Requires marriage certificate.
- **Bereavement**: Requires death certificate.

---

## Historical Leave Requests

The seed creates leave requests in various states for testing:

| Status | Count | Description |
|--------|-------|-------------|
| APPROVED | 2 | Completed requests |
| PENDING | 3 | Awaiting approval |
| REJECTED | 1 | Denied request |
| CANCELLED | 1 | User cancelled |
| DRAFT | 1 | Not yet submitted |

### Sample Requests

1. **Approved Request** (`LR-SEED-APPROVED-1`)
   - User: Andrei Stoica (dev1)
   - Type: Normal Leave
   - Duration: 5 days (completed 30+ days ago)
   - Approved by: Engineering Manager 1

2. **Pending Manager Approval** (`LR-SEED-PENDING-1`)
   - User: Vlad Barbu (dev2)
   - Type: Normal Leave
   - Duration: 5 days (future date)
   - Waiting for: Engineering Manager 1

3. **Pending Director Approval** (`LR-SEED-PENDING-2`)
   - User: George Munteanu (dev3)
   - Type: Normal Leave
   - Duration: 15 days (requires multi-level approval)
   - Manager approved, waiting for: Engineering Director

4. **Rejected Request** (`LR-SEED-REJECTED-1`)
   - User: Stefan Lazar (dev4)
   - Type: Normal Leave
   - Rejected by: Engineering Manager 2
   - Reason: "Critical project deadline"

5. **Sick Leave with HR Verification** (`LR-SEED-SICK-1`)
   - User: Oana Ene (fin2)
   - Type: Sick Leave
   - HR Verified by: HR Specialist 1

6. **Executive Leave Request** (`LR-SEED-EXEC-1`)
   - User: CTO
   - Pending approval from: CEO
   - **Edge case**: Executive needs another executive's approval

---

## Company Settings

| Key | Category | Description |
|-----|----------|-------------|
| `company_info` | general | Company name, country, timezone |
| `default_leave_days` | leave | 21 days normal, 5 max carry forward |
| `approval_settings` | approval | 3-day escalation, 10+ days needs director |
| `notification_settings` | notifications | Email enabled, 7-day reminder |
| `holiday_planning_settings` | holiday_planning | Oct-Dec planning window |

---

## Edge Cases & Special Scenarios

### 1. Executives Approving Each Other

The CEO has the CTO set as their `departmentDirectorId`, enabling:
- When CEO requests leave, CTO can approve
- When CTO/CFO request leave, CEO approves
- Tests cross-executive approval workflows

### 2. Part-Time Employee

`parttime@staging.local`:
- Working pattern: PART_TIME
- Days per week: 3
- Hours per week: 24
- Pro-rated leave entitlement

### 3. Intern Employee

`intern@staging.local`:
- Contract type: INTERN
- Recent joining date (2024)
- Pro-rated leave for current year

### 4. Inactive Employee

`inactive@staging.local`:
- `isActive: false`
- Tests visibility/filtering of inactive users

### 5. Approval Delegation

Engineering Manager 1 → Engineering Manager 2:
- Active during future 2-week period
- Tests delegation of approval authority

### 6. Multi-Level Approval

Request `LR-SEED-PENDING-2` (15 days):
- Level 1: Manager approved
- Level 2: Director pending
- Tests multi-level workflow

---

## Testing Scenarios

### Role-Based Testing

| Test Scenario | Login As | Actions |
|---------------|----------|---------|
| Employee dashboard | `dev1@staging.local` | View balance, submit request |
| Manager approvals | `eng.manager1@staging.local` | Approve pending requests |
| HR verification | `hr1@staging.local` | Verify sick leave documents |
| Director approval | `eng.director@staging.local` | Approve extended leave |
| Executive dashboard | `ceo@staging.local` | Company analytics |
| Admin management | `admin@staging.local` | User/system management |

### Workflow Testing

1. **Simple approval**: Log in as `dev1`, submit 3-day request, approve as `eng.manager1`
2. **Extended approval**: Log in as `dev3`, submit 12-day request, requires manager + director
3. **Rejection flow**: View rejected request as `dev4`
4. **Sick leave + HR**: Log in as `fin1`, submit sick leave, verify as `hr1`
5. **Executive approval**: View pending CTO request as `ceo`

### Balance Testing

- All users have randomized used/pending days
- Part-time user has pro-rated entitlement
- New joiner (intern) has pro-rated for months remaining

### Romanian Holidays

12 public holidays seeded for current year:
- New Year (Jan 1-2)
- Union Day (Jan 24)
- Easter Monday (Orthodox - variable)
- Labour Day (May 1)
- Children's Day (Jun 1)
- Whit Monday (variable)
- Dormition (Aug 15)
- St. Andrew's Day (Nov 30)
- National Day (Dec 1)
- Christmas (Dec 25-26)

---

## Troubleshooting

### Seed Fails with Duplicate Key Error

The seed is designed to be idempotent, but if you encounter issues:

```bash
# Check if data exists
npx prisma studio

# Re-run seed (safe to run multiple times)
pnpm db:seed
```

### Reset and Re-seed (Destructive)

**WARNING: This deletes all data!**

```bash
# Only if you have explicit permission
pnpm db:reset
pnpm db:seed
```

### View Seeded Data

```bash
npx prisma studio
```

Navigate to tables in browser at http://localhost:5555

---

## Maintenance

### Adding New Seed Data

Edit `prisma/seed.ts` and:
1. Add new data to appropriate section
2. Use `upsert` for idempotency
3. Use unique identifiers for `where` clauses
4. Update this documentation

### Updating Leave Balances

Leave balances are created with random usage for testing. To reset:
1. Delete existing balances in Prisma Studio
2. Re-run `pnpm db:seed`
