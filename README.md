# Leave Management System

Internal leave / work-from-home / work-trip management app with multi-level approval workflows, document generation + digital signatures, holiday planning, and role-based dashboards (employee, manager, HR, executive, admin).

**This runs in production with real employee data.** Read [CLAUDE.md](CLAUDE.md) for the database safety rules before doing anything.

## Stack

- **Next.js 15** (App Router, standalone output) + React 19 + TypeScript 5
- **Prisma 6** / PostgreSQL 15 — migrations are hand-written and applied with `prisma migrate deploy` (never `db push` against production)
- **NextAuth 4** — JWT sessions, Azure AD SSO (users must exist in DB before sign-in)
- **MinIO** (documents) · **Redis** (cache) · **Resend** (email) · **Sentry** (errors)
- Tailwind CSS + shadcn/ui

## Local development

```bash
npm install
cp .env.example .env        # fill in at least DATABASE_URL, NEXTAUTH_SECRET
npm run db:up               # Postgres, Redis, MinIO via docker-compose.dev.yml
npm run db:migrate          # apply migrations
npm run db:seed             # seed data
npm run dev                 # http://localhost:3000
```

Set `SHOW_DEV_LOGIN=true` in `.env` to log in without Azure AD during development.

## Quality gates

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit — must stay at 0 errors
npm test            # vitest unit tests (lib/services business logic)
npm run test:smoke  # Playwright smoke (needs a running instance)
```

CI (`.github/workflows/ci.yml`) runs lint + typecheck + unit tests on every push/PR.

## Deployment (production)

Deployment is **manual, directly on the production host** — there is no CD pipeline by design:

```bash
# App-only redeploy (does not touch DB/MinIO/Redis containers):
docker compose -f docker-compose.production.yml up -d --build --no-deps app-production
```

- Secrets live in `.env.production` on the host (never committed).
- On container start, `start.sh` runs `prisma migrate deploy` — pending migrations are applied, schema drift fails loudly. Write a migration under `prisma/migrations/` for every schema change.
- All ports bind to `127.0.0.1`; ingress is via reverse proxy / Cloudflare Tunnel.
- Daily host cron backs up Postgres + MinIO (see `~/leave-backups/backup-prod.sh`).

## Repo layout

| Path | Contents |
|---|---|
| `app/{employee,manager,hr,executive,admin}` | Role dashboards |
| `app/api/` | API route handlers (~220 routes) |
| `lib/services/` | Business logic: balances, pro-rata, rollover, escalation, delegation, analytics |
| `prisma/` | Schema + migrations |
| `tests/unit/` | Vitest unit tests |
| `e2e/`, `tests/` | Playwright suites (smoke, security, a11y, visual, contract) |
| `docs/` | Current docs; `docs/archive/` holds deprecated/historical docs |

## More docs

- [CLAUDE.md](CLAUDE.md) — architecture overview + database safety rules
- [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) — environments and operations detail
- [TESTING.md](TESTING.md) — Playwright test setup
- [docs/audit-2026-06-10.md](docs/audit-2026-06-10.md) — full technical audit + improvement plan
