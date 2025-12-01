/**
 * Custom handler for magic link authentication callback
 * 
 * This route intercepts the credentials callback to:
 * 1. Validate the magic link token
 * 2. Sign the user in via NextAuth
 * 3. Redirect to their connections page
 */

import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/src/lib/auth/config";

// Force Node.js runtime for NextAuth and Prisma compatibility
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/auth/request?error=missing_token", request.url)
      );
    }

    // Attempt to sign in with the token
    // NextAuth will call our authorize function which validates the token
    const result = await signIn("magic-link", {
      token,
      redirect: false,
    });

    // Check if sign in was successful
    if (!result || result.error) {
      console.error("Sign in failed:", result?.error);
      return NextResponse.redirect(
        new URL("/auth/request?error=invalid_token", request.url)
      );
    }

    // Sign in successful - redirect to connections page
    return NextResponse.redirect(new URL("/connections", request.url));
  } catch (error) {
    console.error("Magic link authentication error:", error);
    return NextResponse.redirect(
      new URL("/auth/request?error=authentication_failed", request.url)
    );
  }
}

