import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import fs from 'fs/promises'
import path from 'path'

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
    const { clientId, clientSecret, tenantId } = await request.json()

    if (!clientId || !clientSecret || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Update .env.local file
    const envPath = path.join(process.cwd(), '.env.local')
    let envContent = await fs.readFile(envPath, 'utf-8')

    // Update or add Azure AD configuration
    const updates = {
      AZURE_AD_CLIENT_ID: clientId,
      AZURE_AD_CLIENT_SECRET: clientSecret,
      AZURE_AD_TENANT_ID: tenantId
    }

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'gm')
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}="${value}"`)
      } else {
        envContent += `\n${key}="${value}"`
      }
    }

    await fs.writeFile(envPath, envContent)

    // Note: In production, you'd want to restart the server or use a different approach
    // as environment variables are loaded at startup
    
    return NextResponse.json({ 
      success: true,
      message: 'Configuration saved. You may need to restart the server for changes to take effect.'
    })
  } catch (error) {
    console.error('Error saving Azure config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}