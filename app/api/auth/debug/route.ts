import { NextResponse } from 'next/server'

export async function GET() {
  // Check environment variables (without exposing secrets)
  const config = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? 'SET' : 'NOT SET',
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ? 'SET' : 'NOT SET',
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    expectedCallbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/azure-ad`
  }

  return NextResponse.json(config)
}