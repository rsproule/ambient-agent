/**
 * Admin API: Retry sending a failed message
 */

import prisma from "@/src/db/client";
import { requireAdmin } from "@/src/lib/auth/admin";
import type { handleMessageResponse } from "@/src/trigger/tasks/handleMessage";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  // Check admin auth
  const authResult = await requireAdmin();
  if (!authResult.authorized) {
    return authResult.error;
  }

  const { messageId } = await params;

  try {
    // Get the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: true,
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (message.role !== "assistant") {
      return NextResponse.json(
        { error: "Can only retry assistant messages" },
        { status: 400 },
      );
    }

    if (
      message.deliveryStatus !== "failed" &&
      message.deliveryStatus !== "timeout"
    ) {
      return NextResponse.json(
        { error: "Message is not in a failed state" },
        { status: 400 },
      );
    }

    // Get the message content as text
    const text =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);

    const conversationId = message.conversation.conversationId;
    const isGroup = message.conversation.isGroup;

    console.log(
      `[Admin API] Retrying message ${messageId} to ${conversationId}`,
    );

    // Reset the delivery status to pending
    await prisma.message.update({
      where: { id: messageId },
      data: {
        deliveryStatus: "pending",
        deliveryError: null,
        messageId: null, // Clear old messageId
      },
    });

    // Trigger the message response task
    const taskId = `admin-retry-${messageId}-${Date.now()}`;
    const handle = await tasks.trigger<typeof handleMessageResponse>(
      "handle-message-response",
      {
        conversationId,
        ...(isGroup
          ? { group: conversationId }
          : { recipient: conversationId }),
        actions: [{ type: "message", text }],
        taskId,
        isGroup,
      },
    );

    console.log(`[Admin API] Triggered retry task: ${handle.id}`);

    return NextResponse.json({
      success: true,
      taskId: handle.id,
      messageId,
    });
  } catch (error) {
    console.error("[Admin API] Error retrying message:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to retry message",
      },
      { status: 500 },
    );
  }
}
