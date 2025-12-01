/**
 * Next.js Proxy
 *
 * Protects authenticated routes and handles redirects
 * Note: Proxy always runs on Node.js runtime (no need to specify)
 */

import { auth } from "@/src/lib/auth/config";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /connections routes
  if (pathname.startsWith("/connections")) {
    // Use NextAuth's auth() function to check for valid session
    const session = await auth();

    if (!session?.user) {
      // Redirect to request page if not authenticated
      const url = request.nextUrl.clone();
      url.pathname = "/auth/request";
      // Preserve the original URL as a callback
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Configure which routes to run proxy on
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
