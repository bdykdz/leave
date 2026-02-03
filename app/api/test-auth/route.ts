import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encode } from "next-auth/jwt"
import { Role } from "@prisma/client"

/**
 * Test Authentication API
 *
 * Allows CI/CD pipelines to authenticate programmatically without manual intervention.
 *
 * SECURITY CONTROLS:
 * 1. Only available when APP_ENV=staging
 * 2. Requires TEST_AUTH_SECRET environment variable
 * 3. Never available in production (NODE_ENV=production without APP_ENV=staging)
 * 4. All authentication attempts are logged
 */

// Type for test user data
interface TestUser {
  id: string
  email: string
  name: string
  role: Role
  department: string
  firstName: string
  lastName: string
}

// Validate environment allows test authentication
function isTestAuthEnabled(): { enabled: boolean; reason?: string } {
  // Must have APP_ENV=staging
  if (process.env.APP_ENV !== "staging") {
    return {
      enabled: false,
      reason: "Test authentication only available in staging environment (APP_ENV=staging)"
    }
  }

  // Must have TEST_AUTH_SECRET configured
  if (!process.env.TEST_AUTH_SECRET) {
    return {
      enabled: false,
      reason: "TEST_AUTH_SECRET not configured"
    }
  }

  // Extra safety: explicitly block production
  if (process.env.NODE_ENV === "production" && process.env.APP_ENV !== "staging") {
    return {
      enabled: false,
      reason: "Test authentication disabled in production"
    }
  }

  return { enabled: true }
}

// Validate the provided secret matches
function validateSecret(providedSecret: string | null): boolean {
  if (!providedSecret || !process.env.TEST_AUTH_SECRET) {
    return false
  }

  // Constant-time comparison to prevent timing attacks
  const expected = process.env.TEST_AUTH_SECRET
  if (providedSecret.length !== expected.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < providedSecret.length; i++) {
    result |= providedSecret.charCodeAt(i) ^ expected.charCodeAt(i)
  }

  return result === 0
}

// Create a JWT session token
async function createSessionToken(user: TestUser): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET not configured")
  }

  const token = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      firstName: user.firstName,
      lastName: user.lastName,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    },
    secret,
    maxAge: 24 * 60 * 60, // 24 hours
  })

  return token
}

/**
 * GET /api/test-auth
 *
 * Returns information about test auth availability and test users
 */
export async function GET(request: NextRequest) {
  const authCheck = isTestAuthEnabled()

  if (!authCheck.enabled) {
    return NextResponse.json({
      enabled: false,
      reason: authCheck.reason,
      message: "Test authentication is not available in this environment"
    }, { status: 403 })
  }

  // Validate secret for GET as well (to prevent enumeration)
  const secret = request.headers.get("x-test-auth-secret")
  if (!validateSecret(secret)) {
    return NextResponse.json({
      enabled: true,
      authenticated: false,
      message: "Valid x-test-auth-secret header required"
    }, { status: 401 })
  }

  // Return available test users
  try {
    const testUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
      },
      orderBy: [
        { role: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Group by role for convenience
    const usersByRole: Record<string, typeof testUsers> = {}
    for (const user of testUsers) {
      if (!usersByRole[user.role]) {
        usersByRole[user.role] = []
      }
      usersByRole[user.role].push(user)
    }

    return NextResponse.json({
      enabled: true,
      authenticated: true,
      availableRoles: Object.values(Role),
      usersByRole,
      totalUsers: testUsers.length,
      usage: {
        authenticate: "POST /api/test-auth with { userId: string } or { email: string } or { role: string }",
        headers: "x-test-auth-secret: <your-secret>"
      }
    })
  } catch (error) {
    console.error("Error fetching test users:", error)
    return NextResponse.json({
      error: "Failed to fetch test users"
    }, { status: 500 })
  }
}

/**
 * POST /api/test-auth
 *
 * Authenticate as a test user and receive a session token
 *
 * Request body options:
 * - { userId: string } - Authenticate as specific user by ID
 * - { email: string } - Authenticate as specific user by email
 * - { role: string } - Authenticate as first user with specified role
 *
 * Returns:
 * - sessionToken: JWT token for authentication
 * - user: User details
 * - cookieName: Name of cookie to set
 * - cookieValue: Value to set for the cookie
 */
export async function POST(request: NextRequest) {
  // Log all authentication attempts
  const clientIp = request.headers.get("x-forwarded-for") ||
                   request.headers.get("x-real-ip") ||
                   "unknown"

  console.log(`[TEST-AUTH] Authentication attempt from IP: ${clientIp}`)

  // Check if test auth is enabled
  const authCheck = isTestAuthEnabled()
  if (!authCheck.enabled) {
    console.log(`[TEST-AUTH] Rejected: ${authCheck.reason}`)
    return NextResponse.json({
      error: "Test authentication not available",
      reason: authCheck.reason
    }, { status: 403 })
  }

  // Validate secret
  const secret = request.headers.get("x-test-auth-secret")
  if (!validateSecret(secret)) {
    console.log("[TEST-AUTH] Rejected: Invalid secret")
    return NextResponse.json({
      error: "Invalid or missing x-test-auth-secret header"
    }, { status: 401 })
  }

  // Parse request body
  let body: { userId?: string; email?: string; role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({
      error: "Invalid JSON body"
    }, { status: 400 })
  }

  // Find the user based on criteria
  let user: TestUser | null = null

  try {
    if (body.userId) {
      // Find by user ID
      const dbUser = await prisma.user.findUnique({
        where: { id: body.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          department: true,
        }
      })

      if (dbUser) {
        user = {
          id: dbUser.id,
          email: dbUser.email,
          name: `${dbUser.firstName} ${dbUser.lastName}`,
          role: dbUser.role,
          department: dbUser.department || "",
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
        }
      }
    } else if (body.email) {
      // Find by email
      const dbUser = await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          department: true,
        }
      })

      if (dbUser) {
        user = {
          id: dbUser.id,
          email: dbUser.email,
          name: `${dbUser.firstName} ${dbUser.lastName}`,
          role: dbUser.role,
          department: dbUser.department || "",
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
        }
      }
    } else if (body.role) {
      // Find first user with specified role
      const roleValue = body.role.toUpperCase() as Role
      if (!Object.values(Role).includes(roleValue)) {
        return NextResponse.json({
          error: "Invalid role",
          validRoles: Object.values(Role)
        }, { status: 400 })
      }

      const dbUser = await prisma.user.findFirst({
        where: { role: roleValue },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          department: true,
        },
        orderBy: { lastName: 'asc' }
      })

      if (dbUser) {
        user = {
          id: dbUser.id,
          email: dbUser.email,
          name: `${dbUser.firstName} ${dbUser.lastName}`,
          role: dbUser.role,
          department: dbUser.department || "",
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
        }
      }
    } else {
      return NextResponse.json({
        error: "Must provide userId, email, or role in request body"
      }, { status: 400 })
    }

    if (!user) {
      console.log("[TEST-AUTH] User not found:", body)
      return NextResponse.json({
        error: "User not found matching criteria",
        criteria: body
      }, { status: 404 })
    }

    // Create session token
    const sessionToken = await createSessionToken(user)

    // Determine cookie name based on environment
    const isSecure = process.env.NEXTAUTH_URL?.startsWith("https")
    const cookieName = isSecure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token"

    console.log(`[TEST-AUTH] Success: Authenticated as ${user.email} (${user.role})`)

    // Return token and instructions
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      sessionToken,
      cookie: {
        name: cookieName,
        value: sessionToken,
        options: {
          httpOnly: true,
          secure: isSecure,
          sameSite: "lax",
          path: "/",
          maxAge: 24 * 60 * 60, // 24 hours
        }
      },
      usage: {
        header: `Authorization: Bearer ${sessionToken.substring(0, 20)}...`,
        cookie: `${cookieName}=${sessionToken.substring(0, 20)}...`,
        note: "Set the cookie or pass the session token for authenticated requests"
      }
    })

    // Also set the cookie directly on the response
    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    })

    return response

  } catch (error) {
    console.error("[TEST-AUTH] Error:", error)
    return NextResponse.json({
      error: "Authentication failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
