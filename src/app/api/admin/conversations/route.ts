/**
 * Admin API: List all conversations
 */

import prisma from "@/src/db/client";
import { requireAdmin } from "@/src/lib/auth/admin";
import { NextResponse } from "next/server";

export async function GET() {
  // Check admin auth
  const authResult = await requireAdmin();
  if (!authResult.authorized) {
    return authResult.error;
  }

  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        conversationId: true,
        isGroup: true,
        groupName: true,
        participants: true,
        lastMessageAt: true,
        createdAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    // Transform to include message count at top level
    const result = conversations.map((c) => ({
      id: c.id,
      conversationId: c.conversationId,
      isGroup: c.isGroup,
      groupName: c.groupName,
      participants: c.participants,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      messageCount: c._count.messages,
    }));

    return NextResponse.json({ conversations: result });
  } catch (error) {
    console.error("[Admin API] Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}
