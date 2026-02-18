# Production Credentials Setup Guide

Complete step-by-step guide to configure all credentials for Leave Management System production deployment.

---

## Table of Contents

1. [Overview - What You Need](#1-overview---what-you-need)
2. [Generate Local Secrets](#2-generate-local-secrets)
3. [Azure AD Setup (SSO Login)](#3-azure-ad-setup-sso-login)
4. [Resend Setup (Email Notifications)](#4-resend-setup-email-notifications)
5. [Configure Production Environment](#5-configure-production-environment)
6. [Verify Everything Works](#6-verify-everything-works)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Overview - What You Need

### Credentials Checklist

| Variable | Source | Required | Purpose |
|----------|--------|----------|---------|
| `NEXTAUTH_URL` | Your domain | ✅ Yes | Production URL users access |
| `NEXTAUTH_SECRET` | Generate | ✅ Yes | Encrypts session tokens |
| `AZURE_AD_CLIENT_ID` | Azure Portal | ✅ Yes | Identifies your app to Azure |
| `AZURE_AD_CLIENT_SECRET` | Azure Portal | ✅ Yes | Authenticates your app |
| `AZURE_AD_TENANT_ID` | Azure Portal | ✅ Yes | Your organization ID |
| `SETUP_PASSWORD` | Create | ✅ Yes | Admin access to /setup page |
| `CRON_SECRET` | Generate | ✅ Yes | Secures scheduled jobs |
| `DB_PASSWORD` | Create | ✅ Yes | Database password |
| `MINIO_ACCESS_KEY` | Create | ✅ Yes | File storage username |
| `MINIO_SECRET_KEY` | Create | ✅ Yes | File storage password |
| `RESEND_API_KEY` | Resend.com | ⚠️ Optional | Send email notifications |
| `RESEND_FROM_EMAIL` | Your domain | ⚠️ Optional | Sender email address |
| `RESEND_FROM_NAME` | Create | ⚠️ Optional | Sender display name |

### Before You Start

You will need:
- [ ] Access to your organization's Azure Portal (admin account)
- [ ] A domain name for production (e.g., `lms.yourcompany.com`)
- [ ] SSH access to the production server
- [ ] (Optional) Resend.com account for emails

---

## 2. Generate Local Secrets

Open a terminal on your server and run these commands.

### 2.1 NEXTAUTH_SECRET

This secret encrypts user sessions. Generate it:

```bash
openssl rand -base64 32
```

**Example output:**
```
K7xP9mN2vQ8sL4wR6yT1uJ3hF5gD0aZ2cB7nM9kE4pW=
```

📋 **Copy this value** - you'll need it for `.env.production`

---

### 2.2 CRON_SECRET

This secures the scheduled job endpoints. Generate it:

```bash
openssl rand -base64 32
```

**Example output:**
```
Qw3rT5yU7iO9pA2sD4fG6hJ8kL0zX1cV3bN5mM7qE9=
```

📋 **Copy this value**

---

### 2.3 DB_PASSWORD

Database password. Generate a strong one:

```bash
openssl rand -base64 20
```

**Example output:**
```
H7kL9mN2pQ4sV6wX8yZ0
```

⚠️ **Avoid special characters** like `$`, `@`, `!`, `#` - they can cause issues in connection strings.

📋 **Copy this value**

---

### 2.4 MINIO_ACCESS_KEY (File Storage Username)

```bash
openssl rand -hex 10
```

**Example output:**
```
a7b3c9d2e5f8g1h4k6
```

📋 **Copy this value**

---

### 2.5 MINIO_SECRET_KEY (File Storage Password)

```bash
openssl rand -base64 32
```

**Example output:**
```
mP9nL7kJ5hG3fD1sA8qW6eR4tY2uI0oK3jH5gF7dS9=
```

📋 **Copy this value**

---

### 2.6 SETUP_PASSWORD

Create a password you'll remember for accessing the `/setup` admin page.

Either generate one:
```bash
openssl rand -base64 12
```

Or create your own strong password (minimum 8 characters, mix of letters and numbers).

📋 **Copy this value**

---

### 2.7 Summary - Save These Values

Create a temporary secure note with all generated values:

```
NEXTAUTH_SECRET=<your generated value>
CRON_SECRET=<your generated value>
DB_PASSWORD=<your generated value>
MINIO_ACCESS_KEY=<your generated value>
MINIO_SECRET_KEY=<your generated value>
SETUP_PASSWORD=<your generated value>
```

---

## 3. Azure AD Setup (SSO Login)

This enables "Sign in with Microsoft" for your organization's users.

### 3.1 Open Azure Portal

1. Open your browser
2. Go to: **https://portal.azure.com**
3. Sign in with your **organization's admin account**
   - This should be an account with permissions to register applications
   - Usually an IT admin or Global Administrator

---

### 3.2 Navigate to App Registrations

1. In the **top search bar**, type: `App registrations`
2. Click on **"App registrations"** in the results (under Services)

![Search for App registrations]

You'll see a list of registered applications (may be empty).

---

### 3.3 Create New Application

1. Click the **"+ New registration"** button (top left)

2. Fill in the registration form:

   **Name:**
   ```
   Leave Management System
   ```
   (Or any name you prefer - users will see this when logging in)

   **Supported account types:**
   Select: `Accounts in this organizational directory only (Single tenant)`

   This means only users from your organization can log in.

   **Redirect URI:**
   - Platform dropdown: Select `Web`
   - URL: Enter your production callback URL:
     ```
     https://YOUR-DOMAIN.com/api/auth/callback/azure-ad
     ```

     **Examples:**
     - `https://lms.yourcompany.com/api/auth/callback/azure-ad`
     - `https://leave.yourcompany.ro/api/auth/callback/azure-ad`

     ⚠️ **IMPORTANT:** Replace `YOUR-DOMAIN.com` with your actual production domain!

3. Click **"Register"** button

---

### 3.4 Get Client ID and Tenant ID

After registration, you're on the application's **Overview** page.

You'll see two important values:

| Field | Label in Azure | Copy This |
|-------|----------------|-----------|
| **Application (client) ID** | A GUID like `7592a7a6-1483-4882-b964-277525734975` | → `AZURE_AD_CLIENT_ID` |
| **Directory (tenant) ID** | A GUID like `4ceb9696-348a-4d11-9150-2e028546afef` | → `AZURE_AD_TENANT_ID` |

📋 **Copy both values** to your notes.

---

### 3.5 Create Client Secret

1. In the **left sidebar menu**, click **"Certificates & secrets"**

2. You'll see tabs: "Certificates" and "Client secrets"
   - Make sure **"Client secrets"** tab is selected

3. Click **"+ New client secret"** button

4. Fill in the form:
   - **Description:** `Production Secret` (or any label)
   - **Expires:** Select `24 months` (730 days)

   ⚠️ **Set a calendar reminder** to rotate this secret before it expires!

5. Click **"Add"** button

6. **IMMEDIATELY COPY THE SECRET VALUE!**

   | Column | What It Is |
   |--------|------------|
   | Description | Your label ("Production Secret") |
   | Expires | When it expires |
   | **Value** | ← **THIS IS YOUR `AZURE_AD_CLIENT_SECRET`** |
   | Secret ID | Internal ID (you don't need this) |

   ⚠️⚠️⚠️ **CRITICAL WARNING:**
   - The **Value** is only shown ONCE - right after creation!
   - If you navigate away, you can NEVER see it again
   - You would have to delete and create a new secret
   - **COPY IT NOW** before doing anything else!

📋 **Copy the Value** → This is your `AZURE_AD_CLIENT_SECRET`

---

### 3.6 Configure API Permissions

1. In the **left sidebar menu**, click **"API permissions"**

2. You should see `Microsoft Graph > User.Read` already added by default

3. Click **"+ Add a permission"** button

4. In the panel that opens:
   - Click **"Microsoft Graph"** (first option, big tile)

5. Select **"Delegated permissions"** (not Application permissions)

6. Search and check these permissions:

   | Permission | How to Find | Purpose |
   |------------|-------------|---------|
   | `email` | Search "email" | Get user's email |
   | `openid` | Search "openid" | Required for authentication |
   | `profile` | Search "profile" | Get user's name |
   | `User.Read` | Usually already added | Read user's basic profile |

   For each one:
   - Type the name in the search box
   - Check the checkbox next to it

7. Click **"Add permissions"** button at the bottom

8. **Grant Admin Consent:**

   Back on the API permissions page, you'll see your permissions listed.

   Click the button: **"Grant admin consent for [Your Organization Name]"**

   A popup will ask "Do you want to grant consent...?"
   Click **"Yes"**

   All permissions should now show a green checkmark ✅ under "Status"

---

### 3.7 Verify Authentication Settings

1. In the **left sidebar menu**, click **"Authentication"**

2. Under **"Platform configurations"** > **"Web"**:

   Verify your **Redirect URI** is correct:
   ```
   https://YOUR-DOMAIN.com/api/auth/callback/azure-ad
   ```

3. Scroll down to **"Implicit grant and hybrid flows"**

   Check the box: ✅ **ID tokens (used for implicit and hybrid flows)**

4. Scroll down to **"Advanced settings"**

   **Allow public client flows:** Leave as `No`

5. Click **"Save"** button at the top (if you made any changes)

---

### 3.8 Summary - Azure AD Values

You should now have these three values:

```
AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## 4. Resend Setup (Email Notifications)

⚠️ **This is optional.** Skip this section if you don't need email notifications.

Resend sends emails for:
- Leave request notifications
- Approval reminders
- Status updates

### 4.1 Create Resend Account

1. Go to: **https://resend.com**
2. Click **"Get Started"** or **"Sign Up"**
3. Sign up with your email
4. Verify your email address

---

### 4.2 Add and Verify Your Domain

For emails to be delivered reliably, you need to verify your domain.

1. In Resend dashboard, click **"Domains"** in the left sidebar

2. Click **"+ Add Domain"** button

3. Enter your domain:
   ```
   yourcompany.com
   ```
   (Just the domain, no https:// or www)

4. Click **"Add"**

5. Resend will show you **DNS records** to add. You'll see something like:

   | Type | Name | Value |
   |------|------|-------|
   | TXT | resend._domainkey | p=MIGfMA0GCSq... |
   | TXT | @ or yourcompany.com | v=spf1 include:... |

6. **Add these DNS records** in your domain registrar:
   - Go to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.)
   - Find DNS settings
   - Add the TXT records exactly as shown

7. Back in Resend, click **"Verify"**
   - It may take 5-30 minutes for DNS to propagate
   - You can click verify multiple times until it succeeds

8. Once verified, you'll see a green ✅ checkmark

---

### 4.3 Create API Key

1. In Resend dashboard, click **"API Keys"** in the left sidebar

2. Click **"+ Create API Key"** button

3. Fill in:
   - **Name:** `Leave Management Production`
   - **Permission:** `Full access` (or "Sending access" for more security)
   - **Domain:** Select your verified domain (optional)

4. Click **"Create"**

5. **COPY THE API KEY IMMEDIATELY!**

   It starts with `re_` and looks like:
   ```
   re_Yu65NPxp_MZctB7BdLaAV7vZQRvbdwJ6c
   ```

   ⚠️ Like Azure, you can only see this once!

📋 **Copy this** → This is your `RESEND_API_KEY`

---

### 4.4 Choose From Email

Pick an email address from your verified domain:

```
RESEND_FROM_EMAIL=noreply@yourcompany.com
```

or

```
RESEND_FROM_EMAIL=leave-system@yourcompany.com
```

The email doesn't need to be a real mailbox - Resend just uses it as the sender.

---

### 4.5 Summary - Resend Values

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourcompany.com
RESEND_FROM_NAME=Leave Management System
```

---

## 5. Configure Production Environment

Now let's put all the credentials together.

### 5.1 Open the Environment File

On your production server:

```bash
cd /opt/leave-management/leave
nano .env.production
```

---

### 5.2 Fill In All Values

Replace the placeholder values with your actual credentials:

```env
# ===========================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ===========================================

# ------------------------------------------
# Application URL
# ------------------------------------------
# The full URL where users access the application
# Must include https:// and match your domain exactly
NEXTAUTH_URL=https://lms.yourcompany.com

# ------------------------------------------
# Authentication Secret
# ------------------------------------------
# Generated with: openssl rand -base64 32
# Used to encrypt session cookies
NEXTAUTH_SECRET=K7xP9mN2vQ8sL4wR6yT1uJ3hF5gD0aZ2cB7nM9kE4pW=

# ------------------------------------------
# Azure AD Configuration
# ------------------------------------------
# From Azure Portal > App registrations > Your app > Overview
AZURE_AD_CLIENT_ID=7592a7a6-1483-4882-b964-277525734975
AZURE_AD_TENANT_ID=4ceb9696-348a-4d11-9150-2e028546afef

# From Azure Portal > App registrations > Your app > Certificates & secrets
AZURE_AD_CLIENT_SECRET=your-secret-value-here

# ------------------------------------------
# Admin Security
# ------------------------------------------
# Password to access /setup page for initial configuration
SETUP_PASSWORD=YourSecureAdminPassword123

# Secret for cron job authentication
# Generated with: openssl rand -base64 32
CRON_SECRET=Qw3rT5yU7iO9pA2sD4fG6hJ8kL0zX1cV3bN5mM7qE9=

# ------------------------------------------
# Database
# ------------------------------------------
# Strong password for PostgreSQL
# Generated with: openssl rand -base64 20
DB_PASSWORD=H7kL9mN2pQ4sV6wX8yZ0

# ------------------------------------------
# File Storage (MinIO)
# ------------------------------------------
# Access key (like username)
MINIO_ACCESS_KEY=a7b3c9d2e5f8g1h4k6

# Secret key (like password)
MINIO_SECRET_KEY=mP9nL7kJ5hG3fD1sA8qW6eR4tY2uI0oK3jH5gF7dS9=

# ------------------------------------------
# Email (Optional - leave empty to disable)
# ------------------------------------------
# From Resend dashboard > API Keys
RESEND_API_KEY=re_Yu65NPxp_MZctB7BdLaAV7vZQRvbdwJ6c

# Must be from your verified domain in Resend
RESEND_FROM_EMAIL=noreply@yourcompany.com

# Display name for emails
RESEND_FROM_NAME=Leave Management System

# ------------------------------------------
# NEVER SET IN PRODUCTION
# ------------------------------------------
# SHOW_DEV_LOGIN=true  # NEVER enable this in production!
```

---

### 5.3 Save and Exit

In nano:
1. Press `Ctrl + O` (save)
2. Press `Enter` (confirm filename)
3. Press `Ctrl + X` (exit)

---

### 5.4 Restart Production Containers

Apply the new configuration:

```bash
# Stop production containers
docker-compose -f docker-compose.production.yml down

# Start with new config
docker-compose -f docker-compose.production.yml up -d
```

Wait about 30 seconds for all services to start.

---

## 6. Verify Everything Works

### 6.1 Check Containers Are Running

```bash
docker ps | grep production
```

You should see 4 containers with status "Up" and "(healthy)":
- `leave-management-app-production`
- `leave-management-db-production`
- `leave-management-redis-production`
- `leave-management-minio-production`

---

### 6.2 Check Application Health

```bash
curl http://localhost:8083/api/health
```

Expected response:
```json
{"status":"healthy","environment":"production",...}
```

---

### 6.3 Check Application Logs

```bash
docker logs leave-management-app-production --tail 50
```

Look for:
- ✅ `Azure AD Config loaded: { hasClientId: true, hasClientSecret: true, hasTenantId: true }`
- ✅ `Redis connected successfully`
- ✅ `Ready in XXXms`

If you see `RESEND_API_KEY not found`, emails are disabled (OK if you didn't configure it).

---

### 6.4 Test Azure AD Login

1. Open browser: `https://your-domain.com`
2. Click **"Sign in with Microsoft"**
3. You should be redirected to Microsoft login
4. After login, you should either:
   - Be redirected to your dashboard (if user exists in DB)
   - See an error "User not found" (if user needs to be imported first)

---

### 6.5 Import Users (First Time Setup)

1. Go to: `https://your-domain.com/setup`
2. Enter your `SETUP_PASSWORD`
3. Upload your employee list (Excel/CSV)
4. Or manually add users

---

## 7. Troubleshooting

### Problem: "Invalid redirect URI" or "AADSTS50011"

**Cause:** The redirect URI in Azure doesn't match your actual URL.

**Fix:**
1. Go to Azure Portal > App registrations > Your app > Authentication
2. Check the redirect URI is EXACTLY:
   ```
   https://YOUR-DOMAIN.com/api/auth/callback/azure-ad
   ```
3. Common mistakes:
   - Missing `https://` (http won't work)
   - Wrong domain
   - Trailing slash issues (`/azure-ad` vs `/azure-ad/`)
   - Port number missing if using non-standard port

---

### Problem: "AADSTS700016: Application not found"

**Cause:** Wrong Client ID or app was deleted.

**Fix:**
1. Go to Azure Portal > App registrations
2. Verify the app exists
3. Copy the Client ID again and update `.env.production`

---

### Problem: "AADSTS7000215: Invalid client secret"

**Cause:** Client secret is wrong or expired.

**Fix:**
1. Go to Azure Portal > App registrations > Your app > Certificates & secrets
2. Check if the secret is expired
3. Create a new secret
4. Update `AZURE_AD_CLIENT_SECRET` in `.env.production`
5. Restart: `docker-compose -f docker-compose.production.yml restart app-production`

---

### Problem: "User not found" after successful login

**Cause:** User authenticated with Azure but doesn't exist in database.

**This is expected behavior!** The app requires users to be imported first.

**Fix:**
1. Go to `/setup` with admin password
2. Import the user via Excel upload or manual add

---

### Problem: Emails not sending

**Check 1:** Is RESEND_API_KEY set?
```bash
docker exec leave-management-app-production env | grep RESEND
```

**Check 2:** Is domain verified in Resend?
- Log into Resend dashboard
- Check Domains page for green checkmark

**Check 3:** Check logs for email errors
```bash
docker logs leave-management-app-production 2>&1 | grep -i email
```

---

### Problem: "Connection refused" or app won't start

**Check database is healthy:**
```bash
docker logs leave-management-db-production
```

**Check if password matches:**
The `DB_PASSWORD` in `.env.production` must match what the database was created with.

If the database already exists with a different password, you need to either:
- Use the original password
- Or delete the volume and recreate (⚠️ loses data):
  ```bash
  docker-compose -f docker-compose.production.yml down -v
  docker-compose -f docker-compose.production.yml up -d
  ```

---

### Problem: Files/documents not uploading

**Check MinIO is healthy:**
```bash
docker logs leave-management-minio-production
```

**Check credentials match:**
`MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` must match between app and MinIO container.

---

## Quick Reference Commands

```bash
# View all production containers
docker ps | grep production

# View app logs
docker logs leave-management-app-production -f

# Restart app only (after config changes)
docker-compose -f docker-compose.production.yml restart app-production

# Restart everything
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d

# Check health
curl http://localhost:8083/api/health

# Access database directly
docker exec -it leave-management-db-production psql -U postgres -d leave_production
```

---

## Security Reminders

1. ✅ **Never commit `.env.production`** - it's in `.gitignore`
2. ✅ **Rotate Azure AD secret** before expiration (set calendar reminder)
3. ✅ **Use HTTPS** in production (configure via reverse proxy)
4. ✅ **Backup credentials** in a secure password manager
5. ✅ **Never set `SHOW_DEV_LOGIN=true`** in production
6. ✅ **Limit `/setup` access** - only use during initial setup
