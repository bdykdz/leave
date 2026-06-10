#!/bin/sh

# Production startup script for Leave Management System
echo "🚀 Starting Leave Management System..."

# Apply pending migrations only — never db push against production data.
# If the schema has drifted from the migration history, this fails loudly
# instead of reconciling destructively; write a migration and redeploy.
# The CLI lives in its own self-contained tree (prisma-cli/) because the
# standalone runner image prunes node_modules and has no .bin shims.
echo "📊 Applying database migrations..."
node prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma || { echo "❌ Migration failed — refusing to start"; exit 1; }

echo "✅ Database migrations applied"

# Change ownership and switch to nextjs user
chown -R nextjs:nodejs /app/.next
chown -R nextjs:nodejs /app/node_modules/.prisma
chown -R nextjs:nodejs /app/document-exports 2>/dev/null || true

# Start the Next.js application as nextjs user
echo "🌐 Starting Next.js application..."
exec su-exec nextjs node server.js