#!/bin/sh

# Production startup script for Leave Management System
echo "🚀 Starting Leave Management System..."

# Generate Prisma client if not available
echo "🔧 Ensuring Prisma client is available..."
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
npx prisma generate 2>/dev/null || echo "⚠️  Warning: Could not generate Prisma client, using existing"

# Apply pending migrations only — never db push against production data.
# If the schema has drifted from the migration history, this fails loudly
# instead of reconciling destructively; write a migration and redeploy.
echo "📊 Applying database migrations..."
npx prisma migrate deploy || { echo "❌ Migration failed — refusing to start"; exit 1; }

echo "✅ Database migrations applied"

# Change ownership and switch to nextjs user
chown -R nextjs:nodejs /app/.next
chown -R nextjs:nodejs /app/node_modules/.prisma
chown -R nextjs:nodejs /app/document-exports 2>/dev/null || true

# Start the Next.js application as nextjs user
echo "🌐 Starting Next.js application..."
exec su-exec nextjs node server.js