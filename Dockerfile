# Production Dockerfile for Leave Management System
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./

# Temporarily remove postinstall to avoid Prisma issues during npm ci
RUN sed -i 's/"postinstall": "prisma generate",//g' package.json

# Install dependencies without postinstall
RUN npm ci --legacy-peer-deps

# Restore postinstall for runtime
RUN sed -i '/"lint": "next lint",/a\    "postinstall": "prisma generate",' package.json

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client with fallback for offline environments
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_ENGINES_SKIP_DOWNLOAD=true

# Try to generate Prisma client, but don't fail the build if it doesn't work
RUN npx prisma generate 2>/dev/null || \
    npm run db:generate 2>/dev/null || \
    echo "Warning: Prisma client generation failed, but continuing build..."

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN apk add --no-cache curl su-exec
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy the standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy lib directory for email service and other utilities
COPY --from=builder /app/lib ./lib

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy startup script
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"


CMD ["./start.sh"]