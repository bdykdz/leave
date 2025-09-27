import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check if Azure AD is configured
    const azureConfigured = !!(
      process.env.AZURE_AD_CLIENT_ID &&
      process.env.AZURE_AD_CLIENT_SECRET &&
      process.env.AZURE_AD_TENANT_ID &&
      process.env.AZURE_AD_CLIENT_ID !== 'your-client-id-from-azure'
    )

    // Check if there are users in the database
    const userCount = await prisma.user.count()
    
    // Check if setup is complete
    const setupSetting = await prisma.companySetting.findUnique({
      where: { key: 'setup_complete' }
    })

    return NextResponse.json({
      isComplete: setupSetting?.value === true,
      azureConfigured,
      userCount,
      clientId: azureConfigured ? process.env.AZURE_AD_CLIENT_ID : null,
      tenantId: azureConfigured ? process.env.AZURE_AD_TENANT_ID : null
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    )
  }
}