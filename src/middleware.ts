/**
 * Next.js Middleware
 * 
 * Protects authenticated routes and handles redirects
 * Runs in Edge runtime for performance
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /connections routes
  if (pathname.startsWith("/connections")) {
    // Check for NextAuth session cookie (JWT)
    // NextAuth v5 uses cookies like "authjs.session-token" or "__Secure-authjs.session-token"
    const sessionCookie = 
      request.cookies.get("authjs.session-token") || 
      request.cookies.get("__Secure-authjs.session-token");

    if (!sessionCookie) {
      // Redirect to request page if not authenticated
      const url = request.nextUrl.clone();
      url.pathname = "/auth/request";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

