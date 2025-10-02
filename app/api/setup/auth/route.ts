import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// In production, this should be an environment variable
const SETUP_PASSWORD = process.env.SETUP_PASSWORD || 'admin123'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (password !== SETUP_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Set a cookie to maintain setup session
    (await cookies()).set('setup-auth', 'true', {
      httpOnly: false, // Allow client-side access for testing
      secure: false, // Disable secure for testing deployment (HTTP)
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 24 hours
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}