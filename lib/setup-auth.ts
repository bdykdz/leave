import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const COOKIE_NAME = 'setup-auth'
const MAX_AGE_SECONDS = 60 * 60 * 24 // 24 hours

/**
 * Validate that SETUP_PASSWORD is configured (not using a default).
 * Returns a 503 response if not configured.
 */
export function getSetupPassword(): string | null {
  const password = process.env.SETUP_PASSWORD
  if (!password) {
    return null
  }
  return password
}

/**
 * Create an HMAC-signed setup auth token.
 */
export function createSetupToken(password: string): string {
  const timestamp = Date.now().toString()
  const hmac = crypto.createHmac('sha256', password).update(timestamp).digest('hex')
  return `${timestamp}:${hmac}`
}

/**
 * Validate an HMAC-signed setup auth token.
 */
export function validateSetupToken(token: string): boolean {
  const password = getSetupPassword()
  if (!password) return false

  const parts = token.split(':')
  if (parts.length !== 2) return false

  const [timestamp, hmac] = parts
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) return false

  // Check token age (24 hours)
  const age = Date.now() - ts
  if (age > MAX_AGE_SECONDS * 1000 || age < 0) return false

  // Verify HMAC
  const expectedHmac = crypto.createHmac('sha256', password).update(timestamp).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'))
}

/**
 * Validate setup auth from cookies. Returns null if valid, or a NextResponse error if invalid.
 */
export async function validateSetupAuth(): Promise<NextResponse | null> {
  const password = getSetupPassword()
  if (!password) {
    return NextResponse.json(
      { error: 'Setup is not available. SETUP_PASSWORD environment variable is not configured.' },
      { status: 503 }
    )
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token || !validateSetupToken(token)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return null
}

/**
 * Check if setup is already complete. Returns a NextResponse error if complete, null otherwise.
 * Use this to block mutations after setup is finished.
 */
export async function checkSetupNotComplete(): Promise<NextResponse | null> {
  try {
    const setupSetting = await prisma.companySetting.findUnique({
      where: { key: 'setup_complete' }
    })
    if (setupSetting?.value === true) {
      return NextResponse.json(
        { error: 'Setup has already been completed. Mutations are no longer allowed via setup endpoints.' },
        { status: 403 }
      )
    }
  } catch {
    // If we can't check, allow setup to proceed (DB might not be ready yet)
  }
  return null
}

export { COOKIE_NAME, MAX_AGE_SECONDS }
