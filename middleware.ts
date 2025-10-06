import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Add security headers to all responses
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Public paths that don't need authentication
  const isPublicPath = 
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/dev") ||
    pathname.startsWith("/setup") ||
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
  
  // If trying to access protected route without auth, redirect to login
  if (!isAuth) {
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
    
    // HR routes
    if (pathname.startsWith("/hr") && userRole !== "HR" && userRole !== "EXECUTIVE" && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url))
    }
    
    // Manager routes
    if (pathname.startsWith("/manager") && !["MANAGER", "DEPARTMENT_DIRECTOR", "HR", "EXECUTIVE", "ADMIN"].includes(userRole)) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    
    // Executive routes
    if (pathname.startsWith("/executive") && userRole !== "EXECUTIVE" && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url))
    }
    
    // Admin routes
    if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url))
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