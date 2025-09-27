# Azure AD Sign-In Troubleshooting

## Common Sign-In Errors

### Error: "An error occurred during sign in"

This usually means the redirect URI is not configured correctly in Azure AD.

## Fix Steps:

### 1. Check Your Redirect URI in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Azure Active Directory** → **App registrations** → **Your App**
3. Go to **Authentication** section
4. Check that you have this **exact** redirect URI:
   ```
   http://localhost:3000/api/auth/callback/azure-ad
   ```
   
   ⚠️ **Common mistakes:**
   - Missing `/api/auth/callback/azure-ad` at the end
   - Using `https` instead of `http` for localhost
   - Having a trailing slash
   - Wrong port number

### 2. Add the Correct Redirect URI

If the URI is missing or wrong:
1. Click **"Add a platform"** or **"Add URI"**
2. Choose **"Web"**
3. Enter exactly: `http://localhost:3000/api/auth/callback/azure-ad`
4. Click **"Configure"** or **"Save"**

### 3. Check Authentication Settings

In the same Authentication section:
- ✅ **ID tokens** should be checked
- ✅ **Access tokens** can be checked (optional)
- **Supported account types** should match your needs

### 4. Clear Browser Data

Sometimes browser extensions or cached data cause issues:
1. Open browser console (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Or try in an Incognito/Private window

### 5. Verify Environment Variables

Make sure in `.env.local`:
```env
NEXTAUTH_URL="http://localhost:3000"
```
(No trailing slash!)

### 6. Check Console for Detailed Errors

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for errors when clicking "Sign in with Microsoft"
4. Common errors:
   - `AADSTS50011`: Redirect URI mismatch
   - `AADSTS700054`: Response type mismatch
   - `AADSTS50059`: No tenant information

### 7. Test Direct Microsoft Login

Try going directly to:
```
http://localhost:3000/api/auth/signin
```

This shows NextAuth's built-in sign-in page which might give more details.

## Still Having Issues?

### Check These:

1. **App Registration Status**
   - Is the app enabled?
   - Are there any conditional access policies blocking it?

2. **User Account**
   - Is the user account active in Azure AD?
   - Does the email in database match exactly (including case)?

3. **Permissions**
   - The app needs at least `User.Read` delegated permission
   - Admin consent might be required

### Debug Mode

Add this to your `.env.local` for more logging:
```env
NEXTAUTH_DEBUG=true
```

Then check the terminal where you run `npm run dev` for detailed logs.

## Working Example

A successful flow should:
1. Click "Sign in with Microsoft"
2. Redirect to: `https://login.microsoftonline.com/...`
3. Enter Microsoft credentials
4. Redirect back to: `http://localhost:3000/api/auth/callback/azure-ad`
5. Process and redirect to: `http://localhost:3000/`

## For Production

Remember to:
1. Add production redirect URI: `https://yourdomain.com/api/auth/callback/azure-ad`
2. Update `NEXTAUTH_URL` to production URL
3. Use HTTPS for production