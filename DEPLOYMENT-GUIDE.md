# Deployment Guide - Leave Management System

This guide explains how to deploy the Leave Management System using the cascade deployment pipeline with Coolify.

## Architecture Overview

```
GitHub Repository
├── main branch      → Production Environment
├── staging branch   → Staging Environment  
└── develop branch   → UAT Environment
```

## Environment Setup

### 1. Coolify Configuration

For each environment (UAT, Staging, Production), configure the following in Coolify:

#### Required Environment Variables:

```bash
# Application
APP_ENV=uat|staging|production
APP_NAME="Leave Management (Environment)"
NODE_ENV=production

# Database
DATABASE_URL="postgresql://user:pass@host:port/dbname"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Azure AD
AZURE_AD_CLIENT_ID="your-azure-client-id"
AZURE_AD_CLIENT_SECRET="your-azure-client-secret"
AZURE_AD_TENANT_ID="your-azure-tenant-id"

# Security
SETUP_PASSWORD="strong-admin-password"
CRON_SECRET="generate-with-openssl-rand-base64-32"
```

#### Optional Environment Variables:

```bash
# Redis (for session storage)
REDIS_URL="redis://host:port"

# MinIO/S3 (for file storage)
MINIO_ENDPOINT="host:port"
MINIO_ACCESS_KEY="access-key"
MINIO_SECRET_KEY="secret-key"
MINIO_BUCKET="leave-management"
```

### 2. GitHub Secrets Configuration

Add these secrets to your GitHub repository:

```bash
# Coolify Webhook URLs
COOLIFY_UAT_WEBHOOK_URL="https://your-coolify.com/webhooks/uat-project-id"
COOLIFY_STAGING_WEBHOOK_URL="https://your-coolify.com/webhooks/staging-project-id"
COOLIFY_PRODUCTION_WEBHOOK_URL="https://your-coolify.com/webhooks/prod-project-id"

# Coolify API Tokens
COOLIFY_UAT_TOKEN="uat-api-token"
COOLIFY_STAGING_TOKEN="staging-api-token"
COOLIFY_PRODUCTION_TOKEN="production-api-token"

# Production URL for health checks
PRODUCTION_URL="https://leave.yourdomain.com"
```

## Deployment Workflow

### Development → UAT (Automatic)

1. Push code to `develop` branch
2. GitHub Actions runs:
   - Linting
   - Type checking
   - Unit tests
   - Integration tests
3. If tests pass, deploys to UAT environment
4. UAT available at: `https://leave-uat.yourdomain.com`

### UAT → Staging (Manual)

1. After UAT testing is complete, create PR: `develop` → `staging`
2. Merge the PR
3. GitHub Actions runs:
   - All previous tests
   - E2E tests
4. If tests pass, deploys to Staging environment
5. Staging available at: `https://leave-staging.yourdomain.com`

### Staging → Production (Manual)

1. After staging testing is complete, create PR: `staging` → `main`
2. Merge the PR
3. GitHub Actions runs:
   - Build verification
   - Smoke tests
   - Critical path E2E tests
4. If tests pass, deploys to Production environment
5. Post-deployment health check
6. Production available at: `https://leave.yourdomain.com`

## Manual Deployment

You can trigger manual deployments using GitHub Actions:

1. Go to GitHub repository → Actions
2. Select the appropriate workflow
3. Click "Run workflow"
4. Choose the branch and click "Run workflow"

## Health Monitoring

Each environment exposes a health endpoint:

- UAT: `https://leave-uat.yourdomain.com/api/health`
- Staging: `https://leave-staging.yourdomain.com/api/health`
- Production: `https://leave.yourdomain.com/api/health`

Health check response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "app": "running"
  }
}
```

## Rollback Procedure

If a deployment fails or issues are discovered:

1. **Immediate**: Revert to previous version in Coolify dashboard
2. **Code fix**: Create hotfix branch from last known good commit
3. **Deploy fix**: Follow normal deployment pipeline

## Database Migrations

Database migrations are handled automatically during deployment:

1. Prisma migrations run during container startup
2. Database schema is updated before app starts
3. Zero-downtime deployment with connection pooling

## Troubleshooting

### Common Issues:

1. **Environment Variables**: Ensure all required env vars are set in Coolify
2. **Database Connection**: Check DATABASE_URL format and network access
3. **Azure AD**: Verify redirect URIs match exactly in Azure AD app registration
4. **Build Failures**: Check Node.js version compatibility (use Node 18+)

### Logs:

- View deployment logs in Coolify dashboard
- Application logs available in container logs
- Database logs in PostgreSQL container

## Security Notes

- Never commit `.env` files to Git
- Use strong, unique passwords for each environment
- Regularly rotate API tokens and secrets
- Enable Coolify security features (firewall, SSL, etc.)
- Monitor health endpoints for anomalies