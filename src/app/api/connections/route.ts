/**
 * API endpoint for managing user connections
 * GET /api/connections - List all connections for authenticated user
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserConnections } from "@/src/db/connection";
import { auth } from "@/src/lib/auth/config";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Use userId from authenticated session (not from query parameters)
    const userId = session.user.id;

    const connections = await getUserConnections(userId);

    return NextResponse.json({ connections });
  } catch (error) {
    console.error("Error fetching connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}
