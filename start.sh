#!/bin/bash

# Production start script for Leave Management System
echo "Starting Leave Management System..."

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the Next.js application
echo "Starting Next.js application..."
exec node server.js