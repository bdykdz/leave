# Post-Fix Audit — Leave Management System

**Date:** 2026-06-10 (same day as the original audit, after the remediation pass)
**Baseline:** [docs/audit-2026-06-10.md](audit-2026-06-10.md) — grade **C–**
**Scope of changes:** 93 files changed (+1,762 / −1,085) in the working tree of `feature/ralph-comprehensive-update`. Nothing committed yet; nothing deployed yet.

---

## New grade: **B–** (up from C–)

**Why B– and not higher:** every Critical finding is resolved and *verified* (not just patched — the build, typecheck, lint, and unit suites all pass, and the production DB migration state was checked before changing the startup path). The safety systems are now real instead of theater. What keeps it from a B/B+ is the remaining structural debt: the approval state machine is still copy-pasted across four routes, the two 1,100-line ManualRequestEntry components still exist, logging is still 694 `console.*` calls, the E2E suite is still brittle, three suspected balance-math bugs are flagged but unresolved, and the on-disk weak secrets still need rotating by the owner. Those are exactly the items that produce the next production incident, and they're untouched by design (high-risk refactors don't belong in the same pass that builds the safety net to do them).

**Why not lower:** the three failure modes most likely to destroy data or ship a crash — destructive schema sync at startup, a build that ignores the compiler, and a CI that can't run — are gone, and the fix pass surfaced and repaired ~15 latent runtime bugs the old configuration had been hiding.

---

## Verified end-state (all measured, not assumed)

| Gate | Before | After |
|---|---|---|
| `npx tsc --noEmit` | **172 errors** (ignored by build) | **0 errors**, and `ignoreBuildErrors: false` — verified by a full successful `next build` |
| `npm run lint` | passes vacuously (rules off) | passes (rules unchanged — see open items) |
| `npm test` | script didn't exist | **vitest: 64 tests, 4 files, all passing** (~1s) |
| CI | 3 pipelines calling nonexistent scripts + dead Coolify webhooks | one `ci.yml`: lint + typecheck + unit tests, blocking on push/PR |
| Production startup | `prisma db push --accept-data-loss` on every boot | `prisma migrate deploy`, fails loudly on drift. Prod `_prisma_migrations` verified clean (all 7 applied, 2 stale rows already marked rolled-back); `migrate diff` against the live DB: **no drift** |
| DB indexes | none on LeaveRequest/Approval/Notification/AuditLog | additive migration `20260610100000_add_core_indexes` (9 indexes), applies on next deploy |
| Analytics queries | ~93 / ~96 / 4N / 24 queries per dashboard call | 2 / 2 / 4 / 2 — return shapes unchanged |
| Env config | silent empty-string fallbacks | `lib/config.ts` Zod validation at boot via `instrumentation.ts`; missing required vars refuse to start, missing optional vars warn with the feature they break |
| `npm audit` | 6 moderate | 6 moderate (unchanged — fixes require next/next-auth major work) |
| `console.*` in app/lib | 694 | 694 (unchanged — deliberate deferral) |

## What was fixed in this pass

### Critical (all three resolved)
- **C1** `start.sh` now runs `migrate deploy`; `start-dev.sh` also lost its `--accept-data-loss` flag (plain `db push` fails on destructive changes instead of accepting them).
- **C2** All 172 TypeScript errors fixed with **zero new `as any`/`@ts-ignore`**; build-time type checking re-enabled and proven by a green production build.
- **C3** Dead Coolify deploy workflows deleted (owner deploys manually via `docker-compose.production.yml`); replaced by a single working quality-gate workflow. `.npmrc` with `legacy-peer-deps=true` added so `npm ci` works in CI (pre-existing `@react-pdf/renderer` vs React 19 peer conflict).

### Real runtime bugs fixed (revealed by the type burn-down)
- `'DIRECTOR'` role comparisons in 4 files — the enum value is `DEPARTMENT_DIRECTOR`, so director-specific logic in holiday planning and team calendar **never executed** (always-false comparison).
- `lib/cleanup-service.ts` — `relation: null` filters on required relations threw `PrismaClientValidationError`, silently aborting every cleanup run (notifications/audit logs were never being cleaned).
- `app/api/manager/delegation/route.ts` — queried nonexistent `session.user.departmentId` (matches the known delegation-audit finding); now matches on department name.
- ASI hazard in the debug route (`(decisions...)` parsed as a function call → ReferenceError), `body` referenced in a catch block before declaration, invalid Prisma `include`s that crashed admin user routes and holiday reconcile, null IDs passed into `OR` clauses silently skipping notifications, stale `user.image` → `profileImage` in 6 manager routes, missing-include crash in migrate-selected-dates, null `firstName` reaching email payloads, audit enum gaps (work-trip actions now auditable).

### Security
- Constant-time comparison (`crypto.timingSafeEqual`) for SETUP_PASSWORD and all four cron-secret checks via a shared `verifyCronAuth()` helper.
- **Bonus bug:** `document-cleanup` cron compared against `Bearer ${process.env.CRON_SECRET}` with no null check — with `CRON_SECRET` unset, sending the literal string `Bearer undefined` authenticated. Now denies when unset.
- `/api/debug/leave-request/[id]` gated off in production.
- Notifications `limit` param clamped to 1–200.

### Tests (new)
- Vitest harness (`tests/unit/`, node env, isolated from Playwright specs). 64 behavioral tests over pro-rata math, balance arithmetic/carry-forward/expiry, year-end rollover, and working-day counting, with Prisma mocked and `TZ=UTC` pinned (the date math is DST-sensitive).

### Hygiene / docs
- **README.md created** (setup → quality gates → manual deploy path).
- CLAUDE.md corrected: real deploy command, `migrate deploy` reality, npm not pnpm, quality-gate section.
- 10 deprecated docs archived to `docs/archive/` (DISCOVERY, 3× HANDOFF, BUG_TRACKING, 3× YEARLY-PLANNING, REPORTPORTAL-SETUP, test-hr-documents).
- Dead deploy surface removed: `vercel.json`, `nixpacks.toml`, `coolify.yaml`, `deploy-hetzner.sh`, `Dockerfile.old`, `Dockerfile.production`, `app/admin-old/`; `tsconfig.tsbuildinfo` untracked and gitignored; `.bak` clutter deleted; 11 `"latest"` dependency specifiers pinned to the installed versions (lockfile re-synced, tests re-verified).

### Accepted as features (owner decisions, unchanged)
- MANAGER role can list all users (`/api/admin/users`).
- Escalation cron auto-cancel behavior.
- In-process node-cron (single-instance deployment).

---

## Suspected bugs surfaced but NOT fixed (need a product/payroll decision)

The new unit tests assert *current* behavior for these and mark them `// NOTE: possible bug:` — changing them changes people's leave balances, so they need an owner call:

1. **`lib/services/pro-rata-service.ts:82`** — `totalDaysInYear` computes 364 (365 in leap years); every mid-year fraction is slightly inflated.
2. **`lib/services/pro-rata-service.ts:101-106`** — the ANNUAL statutory minimum (20 × FTE) is applied *without* scaling by year fraction, so a full-time October joiner gets bumped from ~6.25 pro-rated days to 20. If Romanian-law minimums are meant to be pro-rated for partial-year employment, this over-grants.
3. **`lib/services/leave-balance-service.ts:213`** — `processUserYearEndBalance` carries forward unused balance **without subtracting pending requests**, unlike `LeaveRolloverService` which reserves them. A pending year-end request can be double-counted once approved.

## Remaining open items (the path from B– to A territory)

| Priority | Item | From original audit |
|---|---|---|
| 1 | Rotate on-disk weak secrets (`admin123`, `minioadmin*`, `uat-secret-change-me`) — owner action, needs coordinated restart | H4 |
| 2 | Decide the three balance-math questions above; fix + update tests | new |
| 3 | Unified ApprovalService across manager/executive/HR × leave/WFH/work-trip (strangler pattern behind the new unit tests) | H1 |
| 4 | Merge the ManualRequestEntry twins; delete `approval-dialog.tsx` v1 | M1 |
| 5 | console→logger migration in `app/api` + re-arm ESLint rules incrementally (`no-fallthrough`, `no-unused-vars`, then `no-console`) + flip `eslint.ignoreDuringBuilds` | H7/C2 residue |
| 6 | E2E hardening: `webServer` in Playwright config, kill the 326 `waitForTimeout`s on core flows, credentials from env | H3 |
| 7 | `npm audit` moderates (PostCSS via next, uuid via next-auth) — bundled with a planned Next/NextAuth upgrade | M8 |
| 8 | Unbounded HR export queries (chunk/stream) | M7 residue |
| 9 | Off-site backup copy + one restore drill (operational, outside the repo) | 0.3 |

## Deploy note

The working tree is **uncommitted and undeployed**. The first deploy after committing this will: apply the index migration via the new `migrate deploy` path (verified no drift, so it's the only pending migration), start enforcing env validation at boot (`.env.production` already satisfies it — Azure/NextAuth/DB vars are present), and run the same image build that was verified green locally.
