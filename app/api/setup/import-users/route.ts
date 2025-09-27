import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Client } from '@microsoft/microsoft-graph-client'
import { prisma } from '@/lib/prisma'
import { azureAdConfig } from '@/lib/env'
import bcrypt from 'bcryptjs'
import 'isomorphic-fetch'

// Helper to get access token
async function getAccessToken() {
  const tokenEndpoint = `https://login.microsoftonline.com/${azureAdConfig.tenantId}/oauth2/v2.0/token`
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: azureAdConfig.clientId,
      client_secret: azureAdConfig.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Token error:', error)
    throw new Error('Failed to get access token. Check your Azure AD credentials.')
  }

  const data = await response.json()
  return data.access_token
}

export async function POST(request: NextRequest) {
  // Check if user is authenticated for setup
  const setupAuth = cookies().get('setup-auth')
  if (!setupAuth?.value) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Debug: Log environment variables status
    console.log('Azure AD Config Check:', {
      hasClientId: !!azureAdConfig.clientId,
      hasClientSecret: !!azureAdConfig.clientSecret,
      hasTenantId: !!azureAdConfig.tenantId,
      clientIdLength: azureAdConfig.clientId?.length || 0,
      tenantIdLength: azureAdConfig.tenantId?.length || 0,
      clientId: azureAdConfig.clientId?.substring(0, 8) + '...',
      tenantId: azureAdConfig.tenantId?.substring(0, 8) + '...'
    })

    // Check if Azure AD is configured
    if (!azureAdConfig.clientId || 
        !azureAdConfig.clientSecret || 
        !azureAdConfig.tenantId) {
      return NextResponse.json(
        { 
          error: 'Azure AD not configured',
          message: 'Please save your Azure AD configuration first.'
        },
        { status: 400 }
      )
    }

    // Get access token
    let accessToken
    try {
      accessToken = await getAccessToken()
    } catch (error) {
      return NextResponse.json(
        { 
          error: 'Authentication failed',
          message: 'Could not authenticate with Azure AD. Please verify your credentials are correct.',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 401 }
      )
    }

    // Initialize Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      }
    })

    // Try to get users
    let msUsers = []
    try {
      const response = await client
        .api('/users')
        .select('id,displayName,givenName,surname,mail,department,jobTitle,userPrincipalName')
        .filter('accountEnabled eq true')
        .top(999)
        .get()

      msUsers = response.value
    } catch (graphError: any) {
      console.error('Graph API error:', graphError)
      
      // Check if it's a permissions error
      if (graphError.statusCode === 403 || graphError.message?.includes('Insufficient privileges')) {
        return NextResponse.json(
          { 
            error: 'Insufficient permissions',
            message: 'Your app needs "User.Read.All" APPLICATION permission (not delegated) to import users.',
            instructions: [
              '1. Go to Azure Portal > App registrations > Your app > API permissions',
              '2. Click "Add a permission" > Microsoft Graph > Application permissions',
              '3. Search for and select "User.Read.All"',
              '4. Click "Grant admin consent" (requires admin rights)',
              '5. Wait a few minutes for permissions to propagate',
              '6. Try importing again'
            ]
          },
          { status: 403 }
        )
      }

      throw graphError
    }

    // Import users to database
    const importedUsers = []
    const skippedUsers = []
    const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10)

    console.log(`Processing ${msUsers.length} users from Microsoft Graph`)
    
    for (const msUser of msUsers) {
      // Use mail or userPrincipalName as email
      const email = msUser.mail || msUser.userPrincipalName
      
      if (!email) {
        skippedUsers.push({
          displayName: msUser.displayName || 'Unknown',
          reason: 'No email address'
        })
        console.log(`Skipping user ${msUser.displayName || 'Unknown'} - no email or UPN`)
        continue // Skip users without email
      }

      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase() }
        })

        if (!existingUser) {
          // Determine role based on job title or department
          let role = 'EMPLOYEE'
          const jobTitle = msUser.jobTitle?.toLowerCase() || ''
          const department = msUser.department?.toLowerCase() || ''
          
          if (jobTitle.includes('manager') || jobTitle.includes('lead')) {
            role = 'MANAGER'
          } else if (department.includes('hr') || department.includes('human resources')) {
            role = 'HR'
          } else if (jobTitle.includes('executive') ||
                     jobTitle.includes('director') ||
                     jobTitle.includes('vp') ||
                     jobTitle.includes('vice president') ||
                     jobTitle.includes('president') ||
                     jobTitle.includes('chief') ||
                     jobTitle.includes('ceo') ||
                     jobTitle.includes('cto') ||
                     jobTitle.includes('cfo')) {
            role = 'EXECUTIVE'
          }

          // Create user
          const newUser = await prisma.user.create({
            data: {
              email: email.toLowerCase(),
              firstName: msUser.givenName || msUser.displayName?.split(' ')[0] || 'Unknown',
              lastName: msUser.surname || msUser.displayName?.split(' ').slice(1).join(' ') || 'User',
              employeeId: `EMP${Date.now()}${Math.floor(Math.random() * 1000)}`,
              role: role as any,
              department: msUser.department || 'Unassigned',
              position: msUser.jobTitle || 'Unassigned',
              joiningDate: new Date(),
              password: hashedPassword, // Random password since SSO is used
              isActive: true
            }
          })

          // Create default leave balance for Normal Leave only
          const currentYear = new Date().getFullYear()
          const normalLeaveType = await prisma.leaveType.findFirst({
            where: { code: 'NL' }
          })

          if (normalLeaveType) {
            // Get default leave days from settings
            const defaultLeaveSetting = await prisma.companySetting.findUnique({
              where: { key: 'default_leave_days' }
            })
            const defaultDays = defaultLeaveSetting?.value?.normalLeaveDays || 21

            await prisma.leaveBalance.create({
              data: {
                userId: newUser.id,
                leaveTypeId: normalLeaveType.id,
                year: currentYear,
                entitled: defaultDays,
                used: 0,
                pending: 0,
                available: defaultDays,
                carriedForward: 0
              }
            })
          }

          importedUsers.push({
            id: newUser.id,
            email: newUser.email,
            displayName: msUser.displayName,
            role: newUser.role
          })
        } else {
          console.log(`User ${email} already exists, skipping`)
        }
      } catch (error) {
        console.error(`Failed to import user ${email}:`, error)
      }
    }

    console.log(`Import complete: ${importedUsers.length} users imported, ${skippedUsers.length} skipped`)
    
    return NextResponse.json({
      success: true,
      count: importedUsers.length,
      users: importedUsers,
      totalFound: msUsers.length,
      skipped: skippedUsers.length
    })

  } catch (error: any) {
    console.error('Error importing users:', error)
    return NextResponse.json(
      { 
        error: 'Failed to import users',
        message: error.message || 'An unexpected error occurred',
        details: error.body || error.toString()
      },
      { status: 500 }
    )
  }
}