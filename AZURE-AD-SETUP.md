# Azure AD Setup Guide for Microsoft SSO

## Prerequisites
- Azure Active Directory (Azure AD) tenant
- Admin access to Azure Portal
- Your company's Azure subscription

## Step 1: Register Application in Azure AD

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in the details:
   - **Name**: Leave Management System
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: 
     - Platform: Web
     - URL: `http://localhost:3000/api/auth/callback/azure-ad` (for development)
     - For production: `https://yourdomain.com/api/auth/callback/azure-ad`

## Step 2: Configure Application

1. After registration, you'll see the app overview
2. Copy these values to your `.env.local`:
   - **Application (client) ID** → `AZURE_AD_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`

3. Go to **Certificates & secrets**:
   - Click **New client secret**
   - Add description: "Leave Management System"
   - Choose expiry (recommend 24 months)
   - Copy the **Value** (not the ID) → `AZURE_AD_CLIENT_SECRET`
   - ⚠️ **Save this immediately** - you can't see it again!

## Step 3: Configure API Permissions

1. Go to **API permissions**
2. The following should already be granted:
   - `User.Read` (delegated)
3. These are automatically included with our scope configuration

## Step 4: Update Your Environment Variables

Update `.env.local` with your actual values:
```env
AZURE_AD_CLIENT_ID="12345678-1234-1234-1234-123456789012"
AZURE_AD_CLIENT_SECRET="your-secret-value-here"
AZURE_AD_TENANT_ID="87654321-4321-4321-4321-210987654321"
```

## Step 5: Map Azure AD Users to Database

Since we're using SSO, users need to exist in your database first. The system will:
1. Authenticate users via Microsoft
2. Check if their email exists in the database
3. Allow login only if they're found
4. Update their name from Azure AD profile

### Option A: Manual User Creation
Use Prisma Studio to add users:
```bash
npm run db:studio
```
Add users with their Microsoft email addresses.

### Option B: Bulk Import Script
Create a script to import users from CSV:
```typescript
// scripts/import-users.ts
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import fs from 'fs'

// CSV format: email,firstName,lastName,employeeId,role,department,position
const csvData = fs.readFileSync('users.csv', 'utf-8')
// ... parse and import
```

### Option C: Auto-provisioning (Advanced)
Modify the `signIn` callback to auto-create users:
```typescript
// In NextAuth callbacks
if (!existingUser) {
  // Auto-create user with default role
  await prisma.user.create({
    data: {
      email: user.email!,
      firstName: profile?.given_name || 'Unknown',
      lastName: profile?.family_name || 'User',
      employeeId: generateEmployeeId(),
      role: 'EMPLOYEE', // Default role
      department: 'Unassigned',
      position: 'Unassigned',
      joiningDate: new Date(),
      password: await bcrypt.hash(Math.random().toString(), 10), // Random password since SSO is used
    }
  })
  return true
}
```

## Step 6: Production Deployment

For production:
1. Update redirect URI in Azure AD to your production domain
2. Add production URL to `NEXTAUTH_URL` environment variable
3. Use secure secret management (Azure Key Vault, etc.)

## Step 7: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000

3. Click "Sign in with Microsoft"

4. You should be redirected to Microsoft login

5. After authentication:
   - If your email is in the database → Login successful
   - If not → Error message with instructions

## Troubleshooting

### Common Issues:

1. **"Invalid client" error**
   - Check your client ID is correct
   - Ensure redirect URI matches exactly

2. **"User not found in database" error**
   - Make sure the user's email in database matches their Microsoft email
   - Check email case sensitivity

3. **"AADSTS50011: Redirect URI mismatch"**
   - The redirect URI in Azure AD must match exactly
   - Include the protocol (http/https)
   - Check for trailing slashes

4. **Permissions Error**
   - Ensure the app has `User.Read` permission
   - Admin consent might be required

## Security Best Practices

1. **Production Secrets**
   - Never commit secrets to git
   - Use environment variables
   - Rotate client secrets regularly

2. **User Management**
   - Regular audits of user access
   - Remove users who leave the company
   - Implement proper offboarding

3. **Session Security**
   - Set appropriate session timeouts
   - Use HTTPS in production
   - Implement proper CORS settings

## Additional Resources

- [Azure AD App Registration Docs](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [NextAuth.js Azure AD Provider](https://next-auth.js.org/providers/azure-ad)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)