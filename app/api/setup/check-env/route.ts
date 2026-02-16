import { NextResponse } from 'next/server'
import { validateSetupAuth } from '@/lib/setup-auth'

export async function GET() {
  // Require setup auth — this endpoint previously had NO auth
  const authError = await validateSetupAuth()
  if (authError) return authError

  return NextResponse.json({
    env: {
      hasClientId: !!process.env.AZURE_AD_CLIENT_ID,
      hasClientSecret: !!process.env.AZURE_AD_CLIENT_SECRET,
      hasTenantId: !!process.env.AZURE_AD_TENANT_ID,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV,
    }
  })
}
