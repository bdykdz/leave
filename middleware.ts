import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Simple in-memory rate limiter for middleware
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per minute per IP

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `${ip}:${request.nextUrl.pathname}`
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 }
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count }
}

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 300000)

function addSecurityHeaders(response: NextResponse, pathname: string): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  // Allow framing for API docs route (needed for /docs page embedding)
  if (!pathname.startsWith('/api/docs')) {
    response.headers.set('X-Frame-Options', 'DENY')
  } else {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  }
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}

function createUnauthorizedResponse(pathname: string): NextResponse {
  const response = NextResponse.json(
    { error: 'Unauthorized', message: 'Authentication required' },
    { status: 401 }
  )
  addSecurityHeaders(response, pathname)
  return response
}

function createForbiddenResponse(pathname: string, message: string = 'Access denied'): NextResponse {
  const response = NextResponse.json(
    { error: 'Forbidden', message },
    { status: 403 }
  )
  addSecurityHeaders(response, pathname)
  return response
}

function createRateLimitResponse(pathname: string): NextResponse {
  const response = NextResponse.json(
    { error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' },
    { status: 429 }
  )
  addSecurityHeaders(response, pathname)
  response.headers.set('Retry-After', '60')
  return response
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')

  // Check rate limiting for API routes
  if (isApiRoute) {
    const rateLimitKey = getRateLimitKey(request)
    const { allowed, remaining } = checkRateLimit(rateLimitKey)

    if (!allowed) {
      return createRateLimitResponse(pathname)
    }
  }

  // Add security headers to all responses
  const response = NextResponse.next()
  addSecurityHeaders(response, pathname)

  // Add rate limit headers for API routes
  if (isApiRoute) {
    const rateLimitKey = getRateLimitKey(request)
    const { remaining } = checkRateLimit(rateLimitKey)
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS))
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, remaining)))
  }

  // Public paths that don't need authentication
  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/dev") ||
    pathname.startsWith("/api/docs") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico"

  if (isPublicPath) {
    return response
  }

  // Check if user is authenticated
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  const isAuth = !!token

  // If trying to access protected route without auth
  if (!isAuth) {
    // For API routes, return 401 JSON response
    if (isApiRoute) {
      return createUnauthorizedResponse(pathname)
    }
    // For page routes, redirect to login
    const loginUrl = new URL("/login", request.url)
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // If authenticated and trying to access login, redirect to home
  if (pathname === "/login" && isAuth) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Role-based route protection
  if (token) {
    const userRole = token.role as string
    const userDepartment = token.department as string

    // HR routes - allow HR role, EXECUTIVE, ADMIN, or EMPLOYEE with HR department
    const isHREmployee = userRole === "EMPLOYEE" && userDepartment?.toLowerCase().includes("hr")
    if (pathname.startsWith("/hr") || pathname.startsWith("/api/hr")) {
      if (userRole !== "HR" && userRole !== "EXECUTIVE" && userRole !== "ADMIN" && !isHREmployee) {
        if (isApiRoute) {
          return createForbiddenResponse(pathname, 'HR role required')
        }
        return NextResponse.redirect(new URL("/", request.url))
      }
    }

    // Manager routes
    if (pathname.startsWith("/manager") || pathname.startsWith("/api/manager")) {
      if (!["MANAGER", "DEPARTMENT_DIRECTOR", "HR", "EXECUTIVE", "ADMIN"].includes(userRole)) {
        if (isApiRoute) {
          return createForbiddenResponse(pathname, 'Manager role required')
        }
        return NextResponse.redirect(new URL("/", request.url))
      }
    }

    // Executive routes
    if (pathname.startsWith("/executive") || pathname.startsWith("/api/executive")) {
      if (userRole !== "EXECUTIVE" && userRole !== "ADMIN") {
        if (isApiRoute) {
          return createForbiddenResponse(pathname, 'Executive role required')
        }
        return NextResponse.redirect(new URL("/", request.url))
      }
    }

    // Admin routes
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
      if (userRole !== "ADMIN") {
        if (isApiRoute) {
          return createForbiddenResponse(pathname, 'Admin role required')
        }
        return NextResponse.redirect(new URL("/", request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}