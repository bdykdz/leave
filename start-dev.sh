#!/bin/bash

echo "🚀 Starting Leave Management Development Server..."

echo "📊 Starting cron daemon..."
crond -b -l 2
echo "✅ Cron daemon started"

echo "📊 Running database setup..."
npx prisma generate
npx prisma db push --accept-data-loss

echo "✅ Database setup completed"

echo "🌐 Starting Next.js development server..."
npm run dev