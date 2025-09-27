#!/bin/bash
echo "Starting cron daemon..."
crond -b -l 2
echo "Cron daemon started"
echo "Running database setup..."
npx prisma generate
npx prisma db push
echo "Starting Next.js development server..."
npm run dev
