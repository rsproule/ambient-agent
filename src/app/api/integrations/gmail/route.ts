/**
 * API endpoint for Gmail integration
 * GET /api/integrations/gmail?action={list|search|get}
 * 
 * Note: userId is taken from authenticated session, not query parameters
 * This prevents unauthorized access to other users' Gmail data
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth/config";
import {
  listGmailMessages,
  searchGmailMessages,
  getGmailMessage,
} from "@/src/lib/integrations/gmail";

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get userId from authenticated session (not from query parameters)
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";

    switch (action) {
      case "list": {
        const maxResults = parseInt(searchParams.get("maxResults") || "10");
        const messages = await listGmailMessages(userId, { maxResults });
        return NextResponse.json({ messages });
      }

      case "search": {
        const query = searchParams.get("query");
        if (!query) {
          return NextResponse.json(
            { error: "query is required for search" },
            { status: 400 }
          );
        }
        const messages = await searchGmailMessages(userId, query);
        return NextResponse.json({ messages });
      }

      case "get": {
        const messageId = searchParams.get("messageId");
        if (!messageId) {
          return NextResponse.json(
            { error: "messageId is required" },
            { status: 400 }
          );
        }
        const message = await getGmailMessage(userId, messageId);
        return NextResponse.json({ message });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in Gmail integration:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch Gmail data",
      },
      { status: 500 }
    );
  }
}
