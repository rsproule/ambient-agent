/**
 * Example API endpoint for Gmail integration
 * GET /api/integrations/gmail?userId={userId}&action={list|search}
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listGmailMessages,
  searchGmailMessages,
  getGmailMessage,
} from "@/src/lib/integrations/gmail";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action") || "list";

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

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

