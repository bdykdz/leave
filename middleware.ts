import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith("/login")

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/", req.url))
      }
      return null
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

    // Role-based route protection
    const pathname = req.nextUrl.pathname
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
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|setup).*)",
  ]
}