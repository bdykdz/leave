#!/bin/sh

# Production startup script for Leave Management System
echo "🚀 Starting Leave Management System..."

# Push database schema (for initial setup)
echo "📊 Pushing database schema..."
npx prisma db push --accept-data-loss

# Check if migrations succeeded
if [ $? -eq 0 ]; then
    echo "✅ Database schema sync completed successfully"
else
    echo "❌ Database schema sync failed"
    exit 1
fi

# Regenerate Prisma client to fix WASM issues
echo "🔄 Regenerating Prisma client..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma client generated successfully"
else
    echo "❌ Prisma client generation failed"
    exit 1
fi

# Change ownership and switch to nextjs user
chown -R nextjs:nodejs /app/.next
chown -R nextjs:nodejs /app/node_modules/.prisma

# Start the Next.js application as nextjs user
echo "🌐 Starting Next.js application..."
exec su-exec nextjs node server.js