/**
 * Admin authentication helpers for API routes
 */

import { auth } from "@/src/lib/auth/config";
import { NextResponse } from "next/server";

export interface AdminAuthResult {
  authorized: boolean;
  userId?: string;
  error?: NextResponse;
}

/**
 * Check if the current session belongs to an admin user.
 * Returns an error response if not authenticated or not an admin.
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!session.user.isAdmin) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    authorized: true,
    userId: session.user.id,
  };
}
