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
# Development
pnpm dev              # Start development server on http://localhost:3000
pnpm build            # Build production application
pnpm start            # Start production server
pnpm lint             # Run Next.js linter

# Package management
pnpm install          # Install dependencies (using pnpm-lock.yaml)
```

## Architecture

This is a Next.js 15 leave management application using App Router with role-based dashboards.

### Core Stack
- **Next.js 15.2.4** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library (Radix UI based)
- **react-hook-form** + **Zod** for form handling/validation
- **pnpm** as package manager

### Project Structure
```
/app/                 # Next.js App Router pages
  /page.tsx          # Employee dashboard (default)
  /manager/          # Manager approval dashboard
  /hr/               # HR management dashboard
  /executive/        # Executive analytics dashboard
/components/         # React components
  /ui/               # shadcn/ui components
  /*-form.tsx        # Form components for leave/WFH/remote requests
/lib/utils.ts        # Utility functions (cn helper)
```

### Key Patterns
- Each role has its own route with specific functionality
- Forms use react-hook-form with Zod schemas for validation
- UI components follow shadcn/ui patterns with CVA for variants
- Mock data is currently hardcoded in components (no backend)
- Path alias `@/*` maps to root directory

### Authentication & Setup
- **Initial Setup**: Navigate to `/setup` with admin password to configure Azure AD and import users
- **Microsoft SSO**: Users authenticate via Azure AD/Microsoft 365
- **Role-based access**: Employee, Manager, HR, Executive dashboards
- **Setup password**: Default `admin123` (change via SETUP_PASSWORD env var)

### Current Limitations
- Build errors and linting are ignored in next.config.mjs
- Users must be imported from Microsoft 365 or manually added to database

## Production Deployment

### Database Setup
```bash
# Initialize Prisma and run migrations
npx prisma generate
npx prisma migrate deploy
```

### Required Migrations
The following migrations must be applied for the current codebase:
- `20251016_add_missing_fields` - Adds missing AuditLog fields (entityType, details) and creates ApprovalDelegate table

### Migration Files
Migration files are located in `prisma/migrations/` and will be automatically applied during `npx prisma migrate deploy` in production.

### Environment Variables
Required for production:
```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Authentication
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Azure AD
AZURE_AD_CLIENT_ID="your-client-id"
AZURE_AD_CLIENT_SECRET="your-client-secret"
AZURE_AD_TENANT_ID="your-tenant-id"

# Setup Security
SETUP_PASSWORD="strong-admin-password"
```

### Docker Deployment
```bash
docker build -t leave-management .
docker run -p 3000:3000 --env-file .env leave-management
```

## Testing Authentication

Visit http://localhost:3000 and click "Sign in with Microsoft" to test the authentication flow.

### Important: JWT vs Database Sessions

This application uses JWT session strategy for authentication. The Prisma adapter is **NOT** compatible with JWT sessions and must not be used in the NextAuth configuration. Users must be pre-imported into the database through the /setup interface before they can sign in.

### Authentication Flow

1. User clicks "Sign in with Microsoft"
2. User is redirected to Microsoft login
3. After successful authentication, the app checks if the user exists in the database
4. If user exists, they are granted access with their role from the database
5. If user doesn't exist, they see an error message to contact HR

### Troubleshooting

If you encounter authentication errors:
1. Check the browser console for detailed error messages
2. Verify environment variables are set correctly
3. Ensure the user's email exists in the database (check /api/setup/check-users)
4. Verify redirect URI in Azure AD matches exactly: `http://localhost:3000/api/auth/callback/azure-ad`