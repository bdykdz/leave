# Leave Management System - Production Testing Version

This is a clean production-ready version of the Leave Management System for testing purposes.

## What's Different from Dev Version

✅ **No Dev Role Switcher** - The floating dev mode component is removed  
✅ **No Custom Authentication** - Only Microsoft 365 authentication  
✅ **Clean UI** - No development tools or debug information  
✅ **Production Configuration** - Optimized for testing/production use  
✅ **Different Ports** - Uses port 3001 to avoid conflicts with dev version  

## Quick Start for Testers

### 1. Prerequisites
- Docker and Docker Compose installed
- Microsoft 365 Azure AD application configured
- Resend account (for emails)

### 2. Configuration

1. **Copy environment file**:
   ```bash
   cp .env.production .env
   ```

2. **Update the `.env` file** with your actual values:
   ```env
   # Azure AD Configuration
   AZURE_AD_CLIENT_ID="your-actual-client-id"
   AZURE_AD_CLIENT_SECRET="your-actual-client-secret"
   AZURE_AD_TENANT_ID="your-actual-tenant-id"
   
   # Email Configuration
   RESEND_API_KEY="your-actual-resend-api-key"
   RESEND_FROM_EMAIL="noreply@yourdomain.com"
   COMPANY_NAME="Your Company Name"
   
   # Authentication
   NEXTAUTH_URL="http://localhost:3001"
   NEXTAUTH_SECRET="generate-a-secure-secret"
   ```

### 3. Start the Application

```bash
# Start the production version (uses port 3001)
docker-compose -f docker-compose.production.yml up -d

# Check if it's running
docker-compose -f docker-compose.production.yml ps
```

### 4. Access the Application

- **Application**: http://localhost:3001
- **Setup**: http://localhost:3001/setup (first time only)
- **Database**: localhost:5483 (different port to avoid conflicts)

### 5. Initial Setup

1. Go to http://localhost:3001/setup
2. Use the setup password from your `.env` file
3. Configure Azure AD settings
4. Import users from Microsoft 365
5. Test login with your Microsoft 365 account

## Testing Features

### Authentication
- Only Microsoft 365 SSO available
- Users must be imported through setup interface
- No dev login or role switching

### Email Notifications
- Test leave request notifications
- Test approval/rejection emails
- All emails are in Romanian

### Leave Management
- Submit leave requests
- Manager approvals
- Executive approvals for escalations
- Document generation and signatures

## Stopping the Application

```bash
# Stop the production version
docker-compose -f docker-compose.production.yml down

# Stop and remove volumes (resets database)
docker-compose -f docker-compose.production.yml down -v
```

## Ports Used

- **Application**: 3001 (instead of 3000)
- **Database**: 5483 (instead of 5432)

This allows you to run both dev and production versions simultaneously.

## Troubleshooting

### Can't access the application
- Check if port 3001 is available: `lsof -i :3001`
- Check container logs: `docker-compose -f docker-compose.production.yml logs app`

### Database issues
- Check database logs: `docker-compose -f docker-compose.production.yml logs db`
- Reset database: `docker-compose -f docker-compose.production.yml down -v && docker-compose -f docker-compose.production.yml up -d`

### Authentication issues
- Verify Azure AD redirect URI: `http://localhost:3001/api/auth/callback/azure-ad`
- Check that user exists in database via setup interface
- Check application logs for authentication errors

## Production Deployment

When ready for actual production:

1. Update `NEXTAUTH_URL` to your production domain
2. Update Azure AD redirect URIs
3. Use strong passwords and secrets
4. Configure proper database backups
5. Set up SSL/HTTPS
6. Configure monitoring and logging