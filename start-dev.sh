#!/bin/bash

echo "🚀 Starting Leave Management Development Server..."

echo "📊 Starting cron daemon..."
crond -b -l 2
echo "✅ Cron daemon started"

echo "📊 Running database setup..."
npx prisma generate
# Dev-only schema sync. No --accept-data-loss: if a change would destroy data,
# fail and make the developer decide instead of silently dropping it.
npx prisma db push

echo "✅ Database setup completed"

echo "🌐 Starting Next.js development server..."
npm run dev