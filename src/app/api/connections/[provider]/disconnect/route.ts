/**
 * API endpoint for disconnecting a provider
 * POST /api/connections/{provider}/disconnect
 */

import { NextRequest, NextResponse } from "next/server";
import { getConnection, updateConnection } from "@/src/db/connection";
import { pipedreamClient } from "@/src/lib/pipedream/client";
import type { ConnectionProvider } from "@/src/generated/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get the connection
    const connection = await getConnection(userId, provider as ConnectionProvider);

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Delete from Pipedream if we have an account ID
    if (connection.pipedreamAccountId) {
      try {
        await pipedreamClient.deleteAccount(connection.pipedreamAccountId);
      } catch (error) {
        console.error("Error deleting Pipedream account:", error);
        // Continue anyway to update our database
      }
    }

    // Update connection status to disconnected
    await updateConnection(userId, provider as ConnectionProvider, {
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}

