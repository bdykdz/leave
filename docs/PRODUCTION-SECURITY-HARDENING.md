# Production Security Hardening Guide

This guide covers essential security measures to protect your Leave Management System in production.

---

## Table of Contents

1. [Critical: Fix Exposed Ports](#1-critical-fix-exposed-ports)
2. [Firewall Configuration](#2-firewall-configuration)
3. [Reverse Proxy with HTTPS](#3-reverse-proxy-with-https)
4. [Database Security](#4-database-security)
5. [Application Security](#5-application-security)
6. [Docker Security](#6-docker-security)
7. [Monitoring & Alerts](#7-monitoring--alerts)
8. [Backup Strategy](#8-backup-strategy)
9. [Security Checklist](#9-security-checklist)

---

## 1. Critical: Fix Exposed Ports

### Current Problem

Your services are bound to `0.0.0.0` which means they're accessible from the internet:

```
Database:  5483 → Anyone can try to connect!
Redis:     6383 → No authentication by default!
Adminer:   8181 → Full database access via web!
MinIO:     9105 → File storage accessible!
```

### Solution: Bind to localhost only

Update `docker-compose.production.yml` to only expose the app port:

```yaml
services:
  app-production:
    ports:
      - "127.0.0.1:8083:3000"  # Only app exposed, only to localhost
    # ... rest of config

  db-production:
    # REMOVE the ports section entirely, or bind to localhost only:
    # ports:
    #   - "127.0.0.1:5483:5432"  # Only if you need external access

  redis-production:
    # REMOVE ports section - app connects via internal network

  minio-production:
    ports:
      - "127.0.0.1:9106:9001"  # Console only on localhost if needed
```

### Apply the fix:

```bash
# Stop production
docker-compose -f docker-compose.production.yml down

# Edit the file (see updated version below)
nano docker-compose.production.yml

# Start with secure config
docker-compose -f docker-compose.production.yml up -d
```

---

## 2. Firewall Configuration

### Install and configure UFW (Uncomplicated Firewall)

```bash
# Install UFW
sudo apt install ufw -y

# Default policies: deny incoming, allow outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT: do this first or you'll lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS (for reverse proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow your app port ONLY from specific IPs (optional)
# If using reverse proxy on same server, skip this
# sudo ufw allow from YOUR_OFFICE_IP to any port 8083

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

### Expected output:

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

### Ports that should NOT be accessible from internet:

| Port | Service | Should be blocked |
|------|---------|-------------------|
| 5481-5483 | PostgreSQL | ✅ Block |
| 6381-6383 | Redis | ✅ Block |
| 8181-8182 | Adminer | ✅ Block |
| 9101-9106 | MinIO | ✅ Block (or restrict) |

---

## 3. Reverse Proxy with HTTPS

### Option A: Caddy (Recommended - Automatic HTTPS)

Caddy automatically obtains and renews SSL certificates.

#### Install Caddy:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### Configure Caddy:

```bash
sudo nano /etc/caddy/Caddyfile
```

```
lms.yourcompany.com {
    reverse_proxy localhost:8083

    # Security headers
    header {
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        # XSS protection
        X-XSS-Protection "1; mode=block"
        # Referrer policy
        Referrer-Policy "strict-origin-when-cross-origin"
        # Remove server header
        -Server
    }

    # Rate limiting (optional)
    # rate_limit {
    #     zone dynamic_zone {
    #         key {remote_host}
    #         events 100
    #         window 1m
    #     }
    # }

    # Logging
    log {
        output file /var/log/caddy/access.log
        format json
    }
}
```

#### Start Caddy:

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
```

### Option B: Nginx with Let's Encrypt

#### Install Nginx and Certbot:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

#### Configure Nginx:

```bash
sudo nano /etc/nginx/sites-available/leave-management
```

```nginx
server {
    listen 80;
    server_name lms.yourcompany.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name lms.yourcompany.com;

    # SSL certificates (Certbot will add these)
    ssl_certificate /etc/letsencrypt/live/lms.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lms.yourcompany.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Hide nginx version
    server_tokens off;

    # Proxy to app
    location / {
        proxy_pass http://127.0.0.1:8083;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Rate limiting for login endpoint
    location /api/auth {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://127.0.0.1:8083;
        # ... same proxy settings as above
    }

    # Block sensitive paths
    location ~ /\. {
        deny all;
    }
}
```

#### Enable and get certificate:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/leave-management /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d lms.yourcompany.com

# Reload nginx
sudo systemctl reload nginx
```

---

## 4. Database Security

### 4.1 Strong Password

Ensure `DB_PASSWORD` is strong (already covered in credentials setup).

### 4.2 Remove Adminer in Production

Adminer is a web-based database admin - **never expose it in production!**

```bash
# If adminer is running, stop it
docker stop leave-adminer-1 leave-management-adminer-staging 2>/dev/null

# Remove from docker-compose files or comment out
```

### 4.3 Database Backups

```bash
# Create backup script
cat > /opt/leave-management/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/leave-management/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup production database
docker exec leave-management-db-production pg_dump -U postgres leave_production | gzip > "$BACKUP_DIR/production_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/production_$DATE.sql.gz"
EOF

chmod +x /opt/leave-management/scripts/backup-db.sh
```

#### Schedule daily backups:

```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/leave-management/scripts/backup-db.sh") | crontab -
```

---

## 5. Application Security

### 5.1 Environment Variables

Already configured in `.env.production`:

- ✅ `NEXTAUTH_SECRET` - Strong random secret
- ✅ `CRON_SECRET` - Protects cron endpoints
- ✅ `SETUP_PASSWORD` - Protects admin setup
- ❌ `SHOW_DEV_LOGIN` - Must NOT be set in production

### 5.2 Rate Limiting

The app has built-in rate limiting. Verify it's working:

```bash
# Test rate limiting on login
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8083/api/auth/signin
done
# Should see 429 (Too Many Requests) after several attempts
```

### 5.3 Security Headers

Check security headers:

```bash
curl -I https://lms.yourcompany.com 2>/dev/null | grep -E "X-Frame|X-Content|X-XSS|Strict-Transport"
```

Expected:
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

---

## 6. Docker Security

### 6.1 Don't Run as Root

The Dockerfile already uses a non-root user. Verify:

```bash
docker exec leave-management-app-production whoami
# Should NOT output "root"
```

### 6.2 Read-Only Filesystem (Optional)

Add to docker-compose for extra security:

```yaml
services:
  app-production:
    read_only: true
    tmpfs:
      - /tmp
      - /app/.next/cache
```

### 6.3 Resource Limits

Prevent container from consuming all resources:

```yaml
services:
  app-production:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 6.4 Keep Docker Updated

```bash
# Update Docker regularly
sudo apt update && sudo apt upgrade docker-ce docker-ce-cli containerd.io -y
```

---

## 7. Monitoring & Alerts

### 7.1 Basic Log Monitoring

```bash
# Watch app logs for errors
docker logs -f leave-management-app-production 2>&1 | grep -i "error\|warn\|fail"
```

### 7.2 Health Check Script

```bash
cat > /opt/leave-management/scripts/health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:8083/api/health"
ALERT_EMAIL="admin@yourcompany.com"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$response" != "200" ]; then
    echo "ALERT: Leave Management is DOWN! HTTP $response" | mail -s "Production Alert" $ALERT_EMAIL

    # Try to restart
    docker-compose -f /opt/leave-management/leave/docker-compose.production.yml restart app-production
fi
EOF

chmod +x /opt/leave-management/scripts/health-check.sh
```

#### Schedule every 5 minutes:

```bash
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/leave-management/scripts/health-check.sh") | crontab -
```

### 7.3 Failed Login Monitoring

```bash
# Check for brute force attempts
docker logs leave-management-app-production 2>&1 | grep -i "unauthorized\|invalid\|failed" | tail -20
```

---

## 8. Backup Strategy

### 8.1 What to Backup

| Item | Location | Frequency |
|------|----------|-----------|
| Database | Docker volume | Daily |
| MinIO files | Docker volume | Daily |
| Environment files | `.env.production` | After changes |
| Docker compose | `docker-compose.production.yml` | After changes |

### 8.2 Full Backup Script

```bash
cat > /opt/leave-management/scripts/full-backup.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/opt/leave-management/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

echo "Starting backup..."

# 1. Database
echo "Backing up database..."
docker exec leave-management-db-production pg_dump -U postgres leave_production | gzip > "$BACKUP_DIR/database.sql.gz"

# 2. MinIO files
echo "Backing up files..."
docker run --rm -v leave-production-minio:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/minio-files.tar.gz /data

# 3. Config files (don't include secrets in offsite backups!)
echo "Backing up configs..."
cp /opt/leave-management/leave/docker-compose.production.yml $BACKUP_DIR/

echo "Backup complete: $BACKUP_DIR"
ls -lh $BACKUP_DIR

# Keep only last 30 days
find /opt/leave-management/backups -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
EOF

chmod +x /opt/leave-management/scripts/full-backup.sh
```

---

## 9. Security Checklist

### Before Go-Live

- [ ] All services bound to `127.0.0.1` except app
- [ ] Firewall (UFW) enabled and configured
- [ ] HTTPS configured with valid certificate
- [ ] Adminer removed/disabled
- [ ] Strong passwords for all services
- [ ] `SHOW_DEV_LOGIN` NOT set
- [ ] Security headers configured
- [ ] Rate limiting working

### Weekly Checks

- [ ] Review access logs for suspicious activity
- [ ] Check failed login attempts
- [ ] Verify backups are running
- [ ] Check disk space
- [ ] Review Docker container health

### Monthly Checks

- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Update Docker images: `docker-compose pull`
- [ ] Review user access (remove departed employees)
- [ ] Test backup restoration
- [ ] Check SSL certificate expiration

### Quarterly Checks

- [ ] Rotate secrets (NEXTAUTH_SECRET, API keys)
- [ ] Review Azure AD app permissions
- [ ] Security audit of codebase
- [ ] Penetration testing (optional)

---

## Quick Security Commands

```bash
# Check what ports are exposed
docker ps --format "{{.Names}}: {{.Ports}}" | grep -v "127.0.0.1"

# Check firewall status
sudo ufw status

# Check for failed auth attempts
docker logs leave-management-app-production 2>&1 | grep -c "unauthorized"

# Check SSL certificate expiry
echo | openssl s_client -servername lms.yourcompany.com -connect lms.yourcompany.com:443 2>/dev/null | openssl x509 -noout -dates

# Quick security scan
curl -I https://lms.yourcompany.com 2>/dev/null | head -20

# Check container is not running as root
docker exec leave-management-app-production id
```
