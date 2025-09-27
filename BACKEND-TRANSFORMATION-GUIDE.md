# Transform Mock UI to Real Self-Hosted Application

## Overview
This guide will transform your leave management UI prototype into a fully functional, self-hosted application with real data, authentication, and containerized deployment.

## Phase 1: Database Setup (Week 1)

### Step 1: Install Prisma and PostgreSQL dependencies
```bash
pnpm add prisma @prisma/client
pnpm add -D @types/node
pnpm exec prisma init
```

### Step 2: Create Database Schema
Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// User Management
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  password          String
  firstName         String
  lastName          String
  employeeId        String   @unique
  role              Role     @default(EMPLOYEE)
  department        String
  position          String
  joiningDate       DateTime
  phoneNumber       String?
  profileImage      String?
  isActive          Boolean  @default(true)
  
  // Relations
  managerId         String?
  manager           User?    @relation("ManagerSubordinates", fields: [managerId], references: [id])
  subordinates      User[]   @relation("ManagerSubordinates")
  
  leaveRequests     LeaveRequest[]
  leaveBalances     LeaveBalance[]
  approvals         Approval[]
  notifications     Notification[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum Role {
  EMPLOYEE
  MANAGER
  HR
  EXECUTIVE
}

// Leave Types Configuration
model LeaveType {
  id                String   @id @default(cuid())
  name              String   @unique
  code              String   @unique
  daysAllowed       Int
  carryForward      Boolean  @default(false)
  maxCarryForward   Int?
  requiresApproval  Boolean  @default(true)
  requiresDocument  Boolean  @default(false)
  description       String?
  
  leaveBalances     LeaveBalance[]
  leaveRequests     LeaveRequest[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Employee Leave Balances
model LeaveBalance {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  leaveTypeId       String
  leaveType         LeaveType @relation(fields: [leaveTypeId], references: [id])
  year              Int
  
  entitled          Float    // Total days entitled
  used              Float    @default(0) // Days used
  pending           Float    @default(0) // Days pending approval
  available         Float    // Days available (entitled - used - pending)
  carriedForward    Float    @default(0) // From previous year
  
  @@unique([userId, leaveTypeId, year])
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Leave Requests
model LeaveRequest {
  id                String   @id @default(cuid())
  requestNumber     String   @unique @default(cuid())
  
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  leaveTypeId       String
  leaveType         LeaveType @relation(fields: [leaveTypeId], references: [id])
  
  startDate         DateTime
  endDate           DateTime
  totalDays         Float
  reason            String
  
  substituteId      String?
  substitute        User?    @relation("SubstituteRequests", fields: [substituteId], references: [id])
  
  status            RequestStatus @default(PENDING)
  
  // Document fields
  documentUrl       String?
  generatedDocument GeneratedDocument?
  
  approvals         Approval[]
  comments          Comment[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum RequestStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

// Approval Workflow
model Approval {
  id                String   @id @default(cuid())
  
  leaveRequestId    String
  leaveRequest      LeaveRequest @relation(fields: [leaveRequestId], references: [id])
  
  approverId        String
  approver          User     @relation(fields: [approverId], references: [id])
  
  level             Int      // 1 = Manager, 2 = HR, 3 = Executive
  status            ApprovalStatus @default(PENDING)
  comments          String?
  approvedAt        DateTime?
  
  signature         String?  // Base64 signature image
  signedAt          DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

// Comments/Notes
model Comment {
  id                String   @id @default(cuid())
  
  leaveRequestId    String
  leaveRequest      LeaveRequest @relation(fields: [leaveRequestId], references: [id])
  
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  
  text              String
  isInternal        Boolean  @default(false) // HR internal notes
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Notifications
model Notification {
  id                String   @id @default(cuid())
  
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  
  type              NotificationType
  title             String
  message           String
  link              String?
  
  isRead            Boolean  @default(false)
  readAt            DateTime?
  
  createdAt         DateTime @default(now())
}

enum NotificationType {
  LEAVE_REQUESTED
  LEAVE_APPROVED
  LEAVE_REJECTED
  LEAVE_CANCELLED
  APPROVAL_REQUIRED
  DOCUMENT_READY
}

// Document Templates (for PDF generation)
model DocumentTemplate {
  id                String   @id @default(cuid())
  name              String
  description       String?
  fileUrl           String
  fileType          String
  category          String
  version           Int      @default(1)
  isActive          Boolean  @default(true)
  
  fieldMappings     Json     // Store field positions
  signatureMappings Json     // Store signature positions
  
  createdBy         String
  
  generatedDocuments GeneratedDocument[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Generated Documents
model GeneratedDocument {
  id                String   @id @default(cuid())
  
  templateId        String
  template          DocumentTemplate @relation(fields: [templateId], references: [id])
  
  leaveRequestId    String   @unique
  leaveRequest      LeaveRequest @relation(fields: [leaveRequestId], references: [id])
  
  fileUrl           String
  status            DocumentStatus @default(PENDING_SIGNATURES)
  
  signatures        DocumentSignature[]
  
  createdAt         DateTime @default(now())
  completedAt       DateTime?
}

enum DocumentStatus {
  DRAFT
  PENDING_SIGNATURES
  COMPLETED
}

// Document Signatures
model DocumentSignature {
  id                String   @id @default(cuid())
  
  documentId        String
  document          GeneratedDocument @relation(fields: [documentId], references: [id])
  
  signerId          String
  signer            User     @relation(fields: [signerId], references: [id])
  
  signerRole        String   // employee, manager, hr, executive
  signatureData     String   // Base64 encoded signature
  
  signedAt          DateTime @default(now())
  ipAddress         String?
  userAgent         String?
}

// Company Settings
model CompanySetting {
  id                String   @id @default(cuid())
  key               String   @unique
  value             Json
  category          String
  description       String?
  
  updatedBy         String?
  updatedAt         DateTime @updatedAt
}

// Audit Log
model AuditLog {
  id                String   @id @default(cuid())
  
  userId            String?
  action            String
  entity            String
  entityId          String?
  oldValues         Json?
  newValues         Json?
  
  ipAddress         String?
  userAgent         String?
  
  createdAt         DateTime @default(now())
}
```

### Step 3: Run Database Migrations
```bash
# Create migration
pnpm exec prisma migrate dev --name init

# Generate Prisma Client
pnpm exec prisma generate
```

## Phase 2: Authentication Setup (Week 1-2)

### Step 1: Install NextAuth and dependencies
```bash
pnpm add next-auth @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

### Step 2: Create NextAuth Configuration
Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        
        if (!user || !await bcrypt.compare(credentials.password, user.password)) {
          return null
        }
        
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          image: user.profileImage
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role
        session.user.id = token.id
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
})

export { handler as GET, handler as POST }
```

### Step 3: Create Login Page
Create `app/login/page.tsx`:

```typescript
'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        toast.error('Invalid credentials')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Leave Management System</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="john.doe@company.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
```

## Phase 3: API Routes Implementation (Week 2-3)

### Create API Structure
```
app/api/
├── leave-requests/
│   ├── route.ts (GET all, POST new)
│   └── [id]/
│       ├── route.ts (GET one, PUT update, DELETE)
│       └── approve/route.ts
├── users/
│   ├── route.ts
│   └── [id]/route.ts
├── leave-balances/
│   └── route.ts
└── documents/
    ├── generate/route.ts
    └── [id]/sign/route.ts
```

### Example: Leave Requests API
Create `app/api/leave-requests/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(10),
  substituteId: z.string().optional()
})

// GET /api/leave-requests
export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const userId = searchParams.get('userId')

  const where: any = {}
  if (status) where.status = status
  if (userId) where.userId = userId
  
  // If employee, only show their requests
  if (session.user.role === 'EMPLOYEE') {
    where.userId = session.user.id
  }

  const leaveRequests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          department: true
        }
      },
      leaveType: true,
      approvals: {
        include: {
          approver: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(leaveRequests)
}

// POST /api/leave-requests
export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createLeaveRequestSchema.parse(body)

    // Calculate total days
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Check leave balance
    const currentYear = new Date().getFullYear()
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: session.user.id,
          leaveTypeId: data.leaveTypeId,
          year: currentYear
        }
      }
    })

    if (!leaveBalance || leaveBalance.available < totalDays) {
      return NextResponse.json(
        { error: 'Insufficient leave balance' },
        { status: 400 }
      )
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId: session.user.id,
        leaveTypeId: data.leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason: data.reason,
        substituteId: data.substituteId,
        status: 'PENDING'
      }
    })

    // Update leave balance (add to pending)
    await prisma.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: session.user.id,
          leaveTypeId: data.leaveTypeId,
          year: currentYear
        }
      },
      data: {
        pending: { increment: totalDays },
        available: { decrement: totalDays }
      }
    })

    // Create approval workflow
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { manager: true }
    })

    if (user?.managerId) {
      await prisma.approval.create({
        data: {
          leaveRequestId: leaveRequest.id,
          approverId: user.managerId,
          level: 1,
          status: 'PENDING'
        }
      })

      // Send notification to manager
      await prisma.notification.create({
        data: {
          userId: user.managerId,
          type: 'APPROVAL_REQUIRED',
          title: 'Leave Request Pending Approval',
          message: `${user.firstName} ${user.lastName} has requested ${totalDays} days leave`,
          link: `/manager?request=${leaveRequest.id}`
        }
      })
    }

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Phase 4: Update Frontend Components (Week 3-4)

### Update Leave Request Form to use API
```typescript
// components/leave-request-form.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

export function LeaveRequestForm() {
  const { data: session } = useSession()
  const [leaveTypes, setLeaveTypes] = useState([])
  const [leaveBalances, setLeaveBalances] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch leave types and balances
    fetchLeaveTypes()
    fetchLeaveBalances()
  }, [])

  const fetchLeaveTypes = async () => {
    const res = await fetch('/api/leave-types')
    const data = await res.json()
    setLeaveTypes(data)
  }

  const fetchLeaveBalances = async () => {
    const res = await fetch('/api/leave-balances')
    const data = await res.json()
    setLeaveBalances(data)
  }

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }

      toast.success('Leave request submitted successfully')
      // Redirect or refresh
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Rest of your form with real data...
}
```

## Phase 5: Docker Setup (Week 4)

### Create Docker Configuration
Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN pnpm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### Create docker-compose.yml:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/leavemanagement
      NEXTAUTH_SECRET: your-secret-key-here
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: leavemanagement
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Optional: Adminer for database management
  adminer:
    image: adminer
    ports:
      - "8080:8080"
    depends_on:
      - db

volumes:
  postgres_data:
```

## Phase 6: Environment Configuration

### Create .env.local:
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/leavemanagement"

# NextAuth
NEXTAUTH_SECRET="generate-a-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Email (using Resend as example)
EMAIL_FROM="noreply@yourcompany.com"
RESEND_API_KEY="your-resend-api-key"

# File Storage
UPLOAD_DIR="./uploads"

# Redis (for sessions/cache)
REDIS_URL="redis://localhost:6379"
```

## Phase 7: Data Seeding

### Create seed script
Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create leave types
  const annualLeave = await prisma.leaveType.create({
    data: {
      name: 'Annual Leave',
      code: 'AL',
      daysAllowed: 21,
      carryForward: true,
      maxCarryForward: 5
    }
  })

  const sickLeave = await prisma.leaveType.create({
    data: {
      name: 'Sick Leave',
      code: 'SL',
      daysAllowed: 10,
      carryForward: false,
      requiresDocument: true
    }
  })

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10)

  const hrUser = await prisma.user.create({
    data: {
      email: 'hr@company.com',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      employeeId: 'EMP001',
      role: 'HR',
      department: 'Human Resources',
      position: 'HR Manager',
      joiningDate: new Date('2020-01-15')
    }
  })

  const manager = await prisma.user.create({
    data: {
      email: 'manager@company.com',
      password: hashedPassword,
      firstName: 'Michael',
      lastName: 'Smith',
      employeeId: 'EMP002',
      role: 'MANAGER',
      department: 'Engineering',
      position: 'Engineering Manager',
      joiningDate: new Date('2019-03-10')
    }
  })

  const employee = await prisma.user.create({
    data: {
      email: 'john@company.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Doe',
      employeeId: 'EMP003',
      role: 'EMPLOYEE',
      department: 'Engineering',
      position: 'Software Engineer',
      joiningDate: new Date('2021-06-01'),
      managerId: manager.id
    }
  })

  // Create leave balances
  const currentYear = new Date().getFullYear()

  await prisma.leaveBalance.createMany({
    data: [
      {
        userId: employee.id,
        leaveTypeId: annualLeave.id,
        year: currentYear,
        entitled: 21,
        used: 5,
        available: 16
      },
      {
        userId: employee.id,
        leaveTypeId: sickLeave.id,
        year: currentYear,
        entitled: 10,
        used: 2,
        available: 8
      }
    ]
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### Add to package.json:
```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts",
    "db:migrate": "prisma migrate deploy",
    "db:setup": "prisma generate && prisma migrate deploy && pnpm db:seed"
  }
}
```

## Deployment Steps

### 1. Initial Setup
```bash
# Clone repository
git clone your-repo.git
cd leave-management

# Install dependencies
pnpm install

# Setup database
pnpm db:setup
```

### 2. Development
```bash
# Run locally
pnpm dev

# With Docker
docker-compose up
```

### 3. Production Deployment
```bash
# Build and run with Docker
docker-compose -f docker-compose.prod.yml up -d

# Or deploy to VPS
ssh user@your-server
git pull
pnpm install
pnpm build
pm2 start npm --name "leave-app" -- start
```

## Testing the Real App

1. **Login**: Use seeded credentials (john@company.com / password123)
2. **Create Leave Request**: Now saves to database
3. **Manager Approval**: Real workflow with notifications
4. **View History**: Fetches from database
5. **Generate Reports**: Real data from PostgreSQL

## Key Differences from Mock

| Mock Version | Real Version |
|--------------|--------------|
| Hard-coded data | PostgreSQL database |
| No authentication | NextAuth with sessions |
| Client-side only | Full-stack with API |
| No persistence | Data saved permanently |
| Fake notifications | Real email/in-app alerts |
| Static reports | Dynamic from database |

This transformation gives you a production-ready, self-hosted application with real data persistence, authentication, and containerized deployment!