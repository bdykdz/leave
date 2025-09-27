import { NextResponse } from 'next/server'

export async function GET() {
  // Force reload of environment variables
  const envVars = {
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,
  }

  console.log('Environment check:', {
    clientId: process.env.AZURE_AD_CLIENT_ID,
    hasClientId: !!process.env.AZURE_AD_CLIENT_ID,
    typeOfClientId: typeof process.env.AZURE_AD_CLIENT_ID,
  })

  return NextResponse.json({
    env: {
      hasClientId: !!process.env.AZURE_AD_CLIENT_ID,
      hasClientSecret: !!process.env.AZURE_AD_CLIENT_SECRET,
      hasTenantId: !!process.env.AZURE_AD_TENANT_ID,
      clientIdLength: process.env.AZURE_AD_CLIENT_ID?.length || 0,
      clientIdPreview: process.env.AZURE_AD_CLIENT_ID?.substring(0, 8) + '...',
      tenantIdPreview: process.env.AZURE_AD_TENANT_ID?.substring(0, 8) + '...',
      nodeEnv: process.env.NODE_ENV,
      // Check values directly
      rawValues: {
        clientId: process.env.AZURE_AD_CLIENT_ID || 'undefined',
        tenantId: process.env.AZURE_AD_TENANT_ID || 'undefined',
      },
      // Check both .env and .env.local
      allEnvKeys: Object.keys(process.env).filter(key => 
        key.includes('AZURE') || 
        key.includes('DATABASE') || 
        key.includes('NEXTAUTH')
      ).sort()
    }
  })
}