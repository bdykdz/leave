#!/bin/bash

echo "🚀 Leave Management System - Backend Setup"
echo "========================================"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing..."
    npm install -g pnpm
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Install backend dependencies
echo "📦 Installing backend packages..."
pnpm add prisma @prisma/client next-auth @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs tsx

# Initialize Prisma
echo "🗄️  Setting up database..."
pnpm exec prisma init

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "🔧 Creating .env.local file..."
    cat > .env.local << EOL
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/leavemanagement"

# NextAuth
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"

# Email
EMAIL_FROM="noreply@company.com"

# File Storage
UPLOAD_DIR="./uploads"
EOL
    echo "✅ Created .env.local with default values"
    echo "⚠️  Please update the database credentials!"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p app/api/auth/\[...nextauth\]
mkdir -p app/api/leave-requests
mkdir -p app/api/users
mkdir -p app/api/leave-balances
mkdir -p prisma

# Create lib directory for Prisma client
mkdir -p lib
cat > lib/prisma.ts << 'EOL'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
EOL

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update DATABASE_URL in .env.local"
echo "2. Copy the Prisma schema from BACKEND-TRANSFORMATION-GUIDE.md to prisma/schema.prisma"
echo "3. Run: pnpm exec prisma migrate dev --name init"
echo "4. Run: pnpm db:seed (after creating seed.ts)"
echo "5. Run: pnpm dev"
echo ""
echo "For Docker deployment:"
echo "1. Run: docker-compose up"