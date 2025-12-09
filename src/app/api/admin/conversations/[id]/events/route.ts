/**
 * Admin API: Get events for a conversation
 */

import prisma from "@/src/db/client";
import { requireAdmin } from "@/src/lib/auth/admin";
import { NextRequest, NextResponse } from "next/server";

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

    // Fetch events for this conversation
    const events = await prisma.event.findMany({
      where: { conversationId: conversation.conversationId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        conversationId: e.conversationId,
        userId: e.userId,
        type: e.type,
        source: e.source,
        payload: e.payload,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Admin API] Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 },
    );
  }
}
