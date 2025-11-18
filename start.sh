#!/bin/sh

# Production startup script for Leave Management System
echo "🚀 Starting Leave Management System..."

# Generate Prisma client if not available
echo "🔧 Ensuring Prisma client is available..."
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
npx prisma generate 2>/dev/null || echo "⚠️  Warning: Could not generate Prisma client, using existing"

# Push database schema (for initial setup)
echo "📊 Pushing database schema..."
npx prisma db push --accept-data-loss --skip-generate

echo "✅ Database schema sync completed"

# Change ownership and switch to nextjs user
chown -R nextjs:nodejs /app/.next
chown -R nextjs:nodejs /app/node_modules/.prisma

# Start the Next.js application as nextjs user
echo "🌐 Starting Next.js application..."
exec su-exec nextjs node server.js