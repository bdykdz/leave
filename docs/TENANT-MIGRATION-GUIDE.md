# Azure AD Tenant Migration Guide

How to update all environments after moving to the new Azure AD tenant.
We use a single App Registration for all environments — just add redirect URIs per environment.

---

## Current State

| Environment | Tenant ID | Status |
|-------------|-----------|--------|
| **Production** | See `.env.production` | Done |
| **UAT** | Old tenant - needs update | Needs update |
| **Staging** | placeholder values | Needs setup |

### Production credentials (already configured in `.env.production`)

```env
AZURE_AD_CLIENT_ID=<your-client-id>
AZURE_AD_CLIENT_SECRET=<your-client-secret>
AZURE_AD_TENANT_ID=<your-tenant-id>
```

---

## Step 1 - Add Redirect URIs in Azure Portal

1. Go to **Azure Portal** > **App registrations** > **Leave Management System** (the production one)
2. Click **Authentication** in the sidebar
3. Under **Web** > **Redirect URIs**, you already have:
   ```
   https://leave.tpfing.ro/api/auth/callback/azure-ad
   ```
4. Click **Add URI** and add the UAT and staging URLs:
   ```
   http://localhost:8081/api/auth/callback/azure-ad
   http://localhost:8082/api/auth/callback/azure-ad
   ```
   (adjust if your UAT/staging use different URLs)
5. Click **Save**

---

## Step 2 - Update `.env.uat`

```bash
nano /opt/leave-management/leave/.env.uat
```

Replace the old Azure AD block with the production credentials (copy from `.env.production`):

```env
# Azure AD - NEW TENANT (same app registration as production)
AZURE_AD_CLIENT_ID=<your-client-id>
AZURE_AD_CLIENT_SECRET=<your-client-secret>
AZURE_AD_TENANT_ID=<your-tenant-id>
```

Also fix the quoting on the from name:

```env
RESEND_FROM_NAME="TPF - LMS"
```

---

## Step 3 - Update `.env.staging`

```bash
nano /opt/leave-management/leave/.env.staging
```

Replace the Azure AD placeholder values (copy from `.env.production`):

```env
# Azure AD - NEW TENANT (same app registration as production)
AZURE_AD_CLIENT_ID=<your-client-id>
AZURE_AD_CLIENT_SECRET=<your-client-secret>
AZURE_AD_TENANT_ID=<your-tenant-id>
```

---

## Step 4 - Restart Environments

```bash
# Restart UAT
docker-compose -f docker-compose.uat.yml down
docker-compose -f docker-compose.uat.yml up -d

# Restart Staging
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d
```

---

## Step 5 - Verify

Check the logs for each environment:

```bash
# UAT
docker logs leave-management-app-uat --tail 20

# Staging
docker logs leave-management-app-staging --tail 20
```

Look for:
```
Azure AD Config loaded: { hasClientId: true, hasClientSecret: true, hasTenantId: true }
```

Then test SSO login at each environment's URL.

---

## Checklist

- [ ] Redirect URIs added in Azure Portal for UAT and staging
- [ ] `.env.uat` updated with new tenant credentials
- [ ] `.env.uat` `RESEND_FROM_NAME` quoted properly
- [ ] `.env.staging` updated with new tenant credentials
- [ ] UAT containers restarted and login tested
- [ ] Staging containers restarted and login tested
- [ ] Old tenant App Registrations cleaned up / deleted
