import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    // Debug endpoint is only available in development OR for authenticated admin users
    const isDevelopment = process.env.NODE_ENV === 'development'
    const isAdmin = session?.user?.role === 'ADMIN'

    if (!isDevelopment && !isAdmin) {
      return NextResponse.json(
        { error: 'Not Found' },
        { status: 404 }
      )
    }

    // Check environment variables (without exposing secrets)
    const config = {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID ? 'SET' : 'NOT SET',
      AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET ? 'SET' : 'NOT SET',
      AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      expectedCallbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/azure-ad`
    }

    return NextResponse.json({
      config,
      session: session ? {
        user: {
          id: session.user?.id,
          email: session.user?.email,
          name: session.user?.name,
          role: session.user?.role,
          department: session.user?.department,
          firstName: session.user?.firstName,
          lastName: session.user?.lastName
        },
        expires: session.expires,
        isHR: session.user?.role === 'HR',
        isAdmin: session.user?.role === 'ADMIN',
        canAccessHR: session.user?.role ? ['HR', 'ADMIN'].includes(session.user.role) : false
      } : null
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({
      error: 'Failed to get debug info',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}