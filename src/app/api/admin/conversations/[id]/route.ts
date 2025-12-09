/**
 * Admin API: Get/Delete single conversation
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
    // Fetch conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // For DMs, try to get user context
    let userContext = null;
    if (!conversation.isGroup) {
      // The conversationId is the phone number for DMs
      const user = await prisma.user.findUnique({
        where: { phoneNumber: conversation.conversationId },
        include: {
          userContext: {
            include: {
              documents: {
                where: { isStale: false },
                orderBy: { createdAt: "desc" },
                take: 10,
              },
            },
          },
        },
      });

      if (user?.userContext) {
        userContext = {
          summary: user.userContext.summary,
          facts: user.userContext.facts,
          interests: user.userContext.interests,
          professional: user.userContext.professional,
          timezone: user.userContext.timezone,
          documents: user.userContext.documents.map((d) => ({
            id: d.id,
            title: d.title,
            source: d.source,
            content: d.content,
            createdAt: d.createdAt,
          })),
        };
      }
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        conversationId: conversation.conversationId,
        isGroup: conversation.isGroup,
        groupName: conversation.groupName,
        participants: conversation.participants,
        summary: conversation.summary,
        currentApp: conversation.currentApp,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      },
      messages: conversation.messages.map((m) => ({
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
      userContext,
    });
  } catch (error) {
    console.error("[Admin API] Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    // Delete conversation (messages cascade via onDelete: Cascade)
    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin API] Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 },
    );
  }
}
