#!/bin/sh

# Production startup script for Leave Management System
echo "🚀 Starting Leave Management System..."

# Run database migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy

# Check if migrations succeeded
if [ $? -eq 0 ]; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    exit 1
fi

# Change ownership and switch to nextjs user
chown -R nextjs:nodejs /app/.next
chown -R nextjs:nodejs /app/node_modules/.prisma

# Start the Next.js application as nextjs user
echo "🌐 Starting Next.js application..."
exec su-exec nextjs node server.js