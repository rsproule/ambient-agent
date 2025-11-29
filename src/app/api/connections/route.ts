/**
 * API endpoint for managing user connections
 * GET /api/connections?userId={userId} - List all connections for a user
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserConnections } from "@/src/db/connection";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

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

