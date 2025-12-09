/**
 * Admin API: Get messages for a conversation (paginated)
 *
 * Query params:
 * - limit: number of messages to fetch (default 50)
 * - cursor: cursor for pagination (message ID to fetch before)
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
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)),
    100,
  );
  const cursor = searchParams.get("cursor");

  try {
    // Get the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Fetch messages (newest first for pagination, will reverse on frontend)
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: limit + 1, // Fetch one extra to check if there are more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      }),
    });

    // Check if there are more messages
    const hasMore = messages.length > limit;
    const returnedMessages = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? returnedMessages[returnedMessages.length - 1]?.id
      : null;

    return NextResponse.json({
      messages: returnedMessages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        sender: m.sender,
        messageId: m.messageId,
        attachments: m.attachments,
        forwarded: m.forwarded,
        rejectionReason: m.rejectionReason,
        deliveryStatus: m.deliveryStatus,
        deliveryError: m.deliveryError,
        createdAt: m.createdAt,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[Admin API] Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
