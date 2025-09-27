# Leave Management System - Setup Guide

## Overview
The Leave Management System includes a web-based setup interface at `/setup` that allows administrators to configure Azure AD and import users without accessing the code.

## Accessing the Setup Page

1. **Navigate to**: `http://localhost:3000/setup` (or your production URL)

2. **Admin Authentication**:
   - Default password: `admin123`
   - Change this in production by setting `SETUP_PASSWORD` environment variable

## Setup Process

### Step 1: Azure AD Configuration

1. **Before you start**, register your app in Azure Portal:
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to Azure Active Directory → App registrations
   - Create new registration
   - Add redirect URI: `http://localhost:3000/api/auth/callback/azure-ad`

2. **In the setup page**:
   - Enter your **Application (Client) ID**
   - Enter your **Client Secret** (from Certificates & secrets)
   - Enter your **Directory (Tenant) ID**
   - Click "Save Configuration"

### Step 2: Import Users from Microsoft 365

1. **Prerequisites**:
   - Azure AD must be configured first
   - Your app registration needs `User.Read.All` application permission

2. **Import Process**:
   - Click "Import Users from Microsoft 365"
   - System will fetch all active users from your organization
   - Users are automatically assigned roles based on:
     - Job title containing "Manager" → MANAGER role
     - Department containing "HR" → HR role
     - Title with "Executive/Director/VP" → EXECUTIVE role
     - Everyone else → EMPLOYEE role

3. **What happens**:
   - Creates user accounts in the database
   - Generates default leave balances
   - Sets up user profiles

### Step 3: Complete Setup

1. Click "Complete Setup" in the Database tab
2. System will redirect you to the login page
3. Users can now sign in with their Microsoft accounts

## Important Notes

### Security
- Change the default setup password in production
- The setup page is only accessible before initial setup is complete
- After setup, the page is disabled for security

### User Management
- Users must exist in the database to login
- Email addresses must match between Microsoft 365 and the database
- New employees can be added later through:
  - Re-running the import process
  - Manual addition via database
  - Custom admin interface (if built)

### Troubleshooting

**Can't access setup page?**
- Check if setup was already completed
- Verify you're using the correct URL
- Check browser console for errors

**Import fails?**
- Verify Azure AD credentials are correct
- Ensure your app has proper permissions
- Check if client secret hasn't expired

**Users can't login?**
- Verify their email exists in the database
- Check if email case matches (lowercase recommended)
- Ensure Azure AD configuration is correct

## Production Deployment

1. **Environment Variables** to set:
   ```
   SETUP_PASSWORD=strong-password-here
   NEXTAUTH_URL=https://yourdomain.com
   ```

2. **Security Checklist**:
   - [ ] Change default setup password
   - [ ] Use HTTPS
   - [ ] Restrict setup access by IP (optional)
   - [ ] Regular security audits

3. **Post-Setup**:
   - The setup interface is automatically disabled
   - Future user management should be done through:
     - Direct database access
     - Custom admin interface
     - Microsoft 365 sync scripts

## API Permissions Required

For user import to work, your Azure AD app needs:
- `User.Read.All` (Application permission)
- Admin consent granted

To add these permissions:
1. Go to your app in Azure Portal
2. API permissions → Add permission
3. Microsoft Graph → Application permissions
4. Select `User.Read.All`
5. Grant admin consent