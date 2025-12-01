/**
 * Custom handler for magic link authentication callback
 *
 * This route intercepts the credentials callback to:
 * 1. Validate the magic link token
 * 2. Sign the user in via NextAuth
 * 3. Redirect to their connections page
 */

import { signIn } from "@/src/lib/auth/config";
import { NextRequest, NextResponse } from "next/server";

// Force Node.js runtime for NextAuth and Prisma compatibility
export const runtime = "nodejs";

type ErrorType = "expired" | "invalid" | "not_found" | "unknown";

function parseErrorType(error?: string | null): ErrorType {
  if (!error) return "unknown";
  const errorLower = error.toLowerCase();
  if (errorLower.includes("expired")) return "expired";
  if (errorLower.includes("not found") || errorLower.includes("no magic link"))
    return "not_found";
  if (errorLower.includes("invalid")) return "invalid";
  return "unknown";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  // No token - redirect to login page (which has OG tags)
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    // Attempt to sign in with the token
    // NextAuth will call our authorize function which validates the token
    const result = await signIn("magic-link", {
      token,
      redirect: false,
    });

    // Check if sign in was successful
    if (!result || result.error) {
      console.error("Sign in failed:", result?.error);
      const errorType = parseErrorType(result?.error);
      return NextResponse.redirect(
        new URL(`/auth/error?type=${errorType}`, request.url),
      );
    }

    // Sign in successful - redirect to connections page
    return NextResponse.redirect(new URL("/connections", request.url));
  } catch (error) {
    console.error("Magic link authentication error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = parseErrorType(errorMessage);
    return NextResponse.redirect(
      new URL(`/auth/error?type=${errorType}`, request.url),
    );
  }
}
