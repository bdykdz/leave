# Docker Cron Setup for Leave Management System

## Overview

This setup includes automatic escalation checks running inside Docker containers using cron jobs. The system will automatically check for pending leave requests and escalate them after the configured number of days.

## Quick Start

### 1. Development Environment

```bash
# Stop current npm dev server if running
# Ctrl+C to stop

# Start all services with Docker Compose (includes cron)
docker-compose up -d

# View logs
docker-compose logs -f app

# Check cron logs specifically
docker exec leave-management-app tail -f /var/log/cron.log
```

### 2. Production Environment

```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

## Configuration

### Environment Variables

Update your `.env` file with a secure cron secret:

```env
# Generate a secure random string
CRON_SECRET=$(openssl rand -base64 32)
```

### Cron Schedule

The default schedule runs escalation checks daily at midnight. To modify:

1. Edit `/config/crontab`
2. Rebuild the container: `docker-compose up -d --build app`

Common cron schedules:
- `0 0 * * *` - Daily at midnight (default)
- `0 */6 * * *` - Every 6 hours
- `0 9,15 * * *` - At 9 AM and 3 PM daily
- `*/15 * * * *` - Every 15 minutes (for testing)

## Testing the Setup

### 1. Verify Cron is Running

The setup includes a test cron job that runs every minute. Check if it's working:

```bash
# Wait 1-2 minutes after starting the container
docker exec leave-management-app tail -f /var/log/cron.log

# You should see entries like:
# [2024-01-15 10:30:00] Cron test - This message appears every minute
```

### 2. Test Escalation Manually

```bash
# Trigger escalation check manually
docker exec leave-management-app /app/scripts/escalation-cron.sh

# Or from outside the container
curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/cron/escalation
```

### 3. Simulate Escalation

To test escalation without waiting 3 days:

```sql
-- Connect to database
docker exec -it leave-management-db psql -U postgres -d leavemanagement

-- Update a pending approval to be 4 days old
UPDATE "Approval" 
SET "createdAt" = NOW() - INTERVAL '4 days' 
WHERE status = 'PENDING' 
LIMIT 1;

-- Exit psql
\q
```

Then run the escalation check and verify the approval was escalated.

## Monitoring

### View Cron Logs

```bash
# Real-time logs
docker exec leave-management-app tail -f /var/log/cron.log

# Last 50 lines
docker exec leave-management-app tail -n 50 /var/log/cron.log

# Search for escalation events
docker exec leave-management-app grep "escalation" /var/log/cron.log
```

### Check Container Health

```bash
# View all containers
docker-compose ps

# Check if cron daemon is running
docker exec leave-management-app ps aux | grep cron
```

## Troubleshooting

### Cron Not Running

1. Check if cron daemon is running:
   ```bash
   docker exec leave-management-app ps aux | grep cron
   ```

2. Restart the container:
   ```bash
   docker-compose restart app
   ```

### Escalation Not Working

1. Check environment variables:
   ```bash
   docker exec leave-management-app env | grep CRON
   ```

2. Test the endpoint manually:
   ```bash
   docker exec leave-management-app curl -v http://localhost:3000/api/cron/escalation
   ```

3. Check database connectivity:
   ```bash
   docker exec leave-management-app npx prisma db push
   ```

### Permission Issues

If you see permission errors in logs:

```bash
# Fix script permissions
docker exec leave-management-app chmod +x /app/scripts/*.sh

# Fix log file permissions
docker exec -u root leave-management-app chown node:node /var/log/cron.log
```

## Production Considerations

1. **Remove Test Cron**: Edit `/config/crontab` and remove the test cron job that runs every minute

2. **Secure CRON_SECRET**: Use a strong, unique secret in production:
   ```bash
   openssl rand -base64 32
   ```

3. **Log Rotation**: Consider adding log rotation to prevent disk space issues:
   ```bash
   # Add to crontab
   0 0 * * 0 echo "" > /var/log/cron.log
   ```

4. **Monitoring**: Set up alerts for failed escalation checks

5. **Backup**: Ensure database backups include the escalation-related tables

## Architecture

```
┌─────────────────┐
│  Docker Host    │
├─────────────────┤
│ ┌─────────────┐ │
│ │ Next.js App │ │
│ │   + Cron    │ │──── Port 3000
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ PostgreSQL  │ │──── Port 5432
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │   Redis     │ │──── Port 6379
│ └─────────────┘ │
└─────────────────┘

Cron Flow:
1. Cron daemon runs inside app container
2. Every midnight: escalation-cron.sh executes
3. Script calls internal API endpoint
4. API checks pending approvals > 3 days old
5. Escalates to next level authority
6. Logs results to /var/log/cron.log
```

## Customization

### Change Escalation Days

```sql
-- Update via database
UPDATE "CompanySetting" 
SET value = 5 
WHERE key = 'escalationDaysBeforeAutoApproval';
```

### Disable Escalation Temporarily

```sql
UPDATE "CompanySetting" 
SET value = false 
WHERE key = 'escalationEnabled';
```

### Custom Escalation Logic

Edit `/lib/services/escalation-service.ts` to customize:
- Who to escalate to
- Escalation conditions
- Notification messages