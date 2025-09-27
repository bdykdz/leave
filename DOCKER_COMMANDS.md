# Docker Commands Quick Reference

## Starting the Application with Cron

```bash
# Development mode (with hot reload and cron)
docker-compose up -d

# Production mode
docker-compose -f docker-compose.prod.yml up -d --build

# View all logs
docker-compose logs -f

# View only app logs
docker-compose logs -f app
```

## Monitoring Cron Jobs

```bash
# Watch cron logs in real-time
docker exec leave-management-app tail -f /var/log/cron.log

# Check if cron is running
docker exec leave-management-app ps aux | grep cron

# Manually trigger escalation
docker exec leave-management-app /app/scripts/escalation-cron.sh
```

## Useful Commands

```bash
# Stop all services
docker-compose down

# Restart app container (after config changes)
docker-compose restart app

# Rebuild and restart
docker-compose up -d --build app

# Access container shell
docker exec -it leave-management-app sh

# Check escalation settings in database
docker exec -it leave-management-db psql -U postgres -d leavemanagement -c "SELECT * FROM \"CompanySetting\" WHERE category='escalation';"
```

## Testing Escalation

```bash
# 1. Create a test leave request through the UI

# 2. Make it old enough to escalate
docker exec -it leave-management-db psql -U postgres -d leavemanagement -c "UPDATE \"Approval\" SET \"createdAt\" = NOW() - INTERVAL '4 days' WHERE status = 'PENDING' LIMIT 1;"

# 3. Run escalation manually
docker exec leave-management-app /app/scripts/escalation-cron.sh

# 4. Check logs
docker exec leave-management-app grep "escalation" /var/log/cron.log
```