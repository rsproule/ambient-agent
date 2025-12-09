/**
 * Admin API: Get events for a conversation (paginated)
 *
 * Query params:
 * - limit: number of events to fetch (default 50)
 * - cursor: cursor for pagination (event ID to fetch before)
 */

import prisma from "@/src/db/client";
import { requireAdmin } from "@/src/lib/auth/admin";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LIMIT = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Check admin auth
  const authResult = await requireAdmin();
  if (!authResult.authorized) {
    return authResult.error;
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), 100);
  const cursor = searchParams.get("cursor");

  try {
    // Get the conversation to find its conversationId
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { conversationId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Fetch events for this conversation (newest first, paginate backwards)
    const events = await prisma.event.findMany({
      where: { conversationId: conversation.conversationId },
      orderBy: { createdAt: "desc" },
      take: limit + 1, // Fetch one extra to check if there are more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      }),
    });

    // Check if there are more events
    const hasMore = events.length > limit;
    const returnedEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? returnedEvents[returnedEvents.length - 1]?.id : null;

    return NextResponse.json({
      events: returnedEvents.map((e) => ({
        id: e.id,
        conversationId: e.conversationId,
        userId: e.userId,
        type: e.type,
        source: e.source,
        payload: e.payload,
        createdAt: e.createdAt,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[Admin API] Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 },
    );
  }
}
