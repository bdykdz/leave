# Production Dockerfile for Leave Management System
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# Set alternative CDN for Prisma engines before npm install
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_ENGINES_MIRROR=https://github.com/prisma/prisma-engines/releases

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Use alternative CDN for Prisma engines (bypass Cloudflare)
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV PRISMA_ENGINES_MIRROR=https://github.com/prisma/prisma-engines/releases
ENV PRISMA_ENGINES_DOWNLOAD_URL=https://github.com/prisma/prisma-engines/releases/download

# Alternative: try using jsDelivr CDN as backup
# ENV PRISMA_ENGINES_MIRROR=https://cdn.jsdelivr.net/npm/@prisma/engines

# Generate Prisma client with alternative CDN
RUN npx prisma generate || \
    (echo "Trying with GitHub releases mirror..." && \
     PRISMA_ENGINES_MIRROR=https://github.com/prisma/prisma-engines/releases npx prisma generate) || \
    (echo "Trying with jsDelivr CDN..." && \
     PRISMA_ENGINES_MIRROR=https://cdn.jsdelivr.net/npm/@prisma/engines npx prisma generate) || \
    (echo "All CDNs failed, using cached engines..." && \
     PRISMA_ENGINES_SKIP_DOWNLOAD=true npx prisma generate)

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