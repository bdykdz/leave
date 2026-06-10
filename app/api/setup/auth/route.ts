import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSetupPassword, createSetupToken, COOKIE_NAME, MAX_AGE_SECONDS } from '@/lib/setup-auth'
import { timingSafeEqualStrings } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const password = getSetupPassword()
    if (!password) {
      return NextResponse.json(
        { error: 'Setup is not available. SETUP_PASSWORD environment variable is not configured.' },
        { status: 503 }
      )
    }

    const { password: inputPassword } = await request.json()

    if (typeof inputPassword !== 'string' || !timingSafeEqualStrings(inputPassword, password)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Set an HMAC-signed cookie to maintain setup session
    const token = createSetupToken(password)
    ;(await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.APP_ENV === 'production',
      sameSite: 'lax',
      maxAge: MAX_AGE_SECONDS
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
