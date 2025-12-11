/**
 * API endpoint to check workspace username availability
 * GET /api/workspace/check?username=foo
 */

import { isWorkspaceUsernameAvailable } from "@/src/db/user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "Username parameter is required" },
        { status: 400 },
      );
    }

    // Normalize username to lowercase
    const normalizedUsername = username.toLowerCase();

    // Validate format
    if (!/^[a-zA-Z0-9_-]+$/.test(normalizedUsername)) {
      return NextResponse.json({
        available: false,
        reason: "Invalid characters. Use only letters, numbers, underscores, and hyphens.",
      });
    }

    if (normalizedUsername.length < 2 || normalizedUsername.length > 39) {
      return NextResponse.json({
        available: false,
        reason: "Username must be between 2 and 39 characters.",
      });
    }

    const isAvailable = await isWorkspaceUsernameAvailable(normalizedUsername);

    return NextResponse.json({
      available: isAvailable,
      username: normalizedUsername,
    });
  } catch (error) {
    console.error("Error checking username availability:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 },
    );
  }
}
