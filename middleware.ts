import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { rateLimit } from "./lib/rate-limiter"

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const pathname = req.nextUrl.pathname
    const isAuthPage = pathname.startsWith("/login")

    // Add security headers to all responses
    const response = NextResponse.next()
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // Apply rate limiting for API routes
    if (pathname.startsWith("/api/")) {
      let rateLimitConfig = 'api' // default
      
      // Determine rate limit config based on path
      if (pathname.startsWith("/api/auth")) {
        rateLimitConfig = 'auth'
      } else if (pathname === "/api/leave-requests" && req.method === "POST") {
        rateLimitConfig = 'createLeaveRequest'
      } else if (pathname.startsWith("/api/admin")) {
        rateLimitConfig = 'sensitive'
      } else if (pathname.includes("/upload")) {
        rateLimitConfig = 'upload'
      } else if (req.method === "GET") {
        rateLimitConfig = 'read'
      }
      
      // Apply rate limiting
      const limiter = rateLimit(rateLimitConfig as any)
      const limitResponse = await limiter(req as any)
      if (limitResponse) {
        return limitResponse
      }
    }

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/", req.url))
      }
      return response
    }

    if (!isAuth) {
      let from = req.nextUrl.pathname
      if (req.nextUrl.search) {
        from += req.nextUrl.search
      }

      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
      )
    }

    // Add user ID to headers for rate limiting
    if (token?.sub) {
      response.headers.set('x-user-id', token.sub as string)
    }

    // Role-based route protection
    const userRole = token.role as string

    // HR routes
    if (pathname.startsWith("/hr") && userRole !== "HR" && userRole !== "EXECUTIVE") {
      return NextResponse.redirect(new URL("/", req.url))
    }

    // Manager routes (also accessible by Department Directors)
    if (pathname.startsWith("/manager") && !["MANAGER", "DEPARTMENT_DIRECTOR", "HR", "EXECUTIVE"].includes(userRole)) {
      return NextResponse.redirect(new URL("/", req.url))
    }

    // Executive routes
    if (pathname.startsWith("/executive") && userRole !== "EXECUTIVE") {
      return NextResponse.redirect(new URL("/", req.url))
    }
    
    return response
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|setup).*)",
  ]
}