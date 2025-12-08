/**
 * Admin API: Send a message as Mr. Whiskers to a conversation
 * Uses the same Trigger.dev task as the normal message flow
 */

import { requireAdmin } from "@/src/lib/auth/admin";
import type { handleMessageResponse } from "@/src/trigger/tasks/handleMessage";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Check admin auth
  const authResult = await requireAdmin();
  if (!authResult.authorized) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { recipient, group, text } = body;

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (!recipient && !group) {
      return NextResponse.json(
        { error: "Either recipient or group must be specified" },
        { status: 400 },
      );
    }

    const conversationId = recipient || group;

    console.log(`[Admin API] Sending message as Whiskers to ${conversationId}`);

    // Trigger the same task used by the normal message flow
    const taskId = `admin-send-${Date.now()}`;
    const handle = await tasks.trigger<typeof handleMessageResponse>(
      "handle-message-response",
      {
        conversationId,
        recipient,
        group,
        actions: [{ type: "message", text }],
        taskId,
        isGroup: !!group,
      },
    );

    console.log(`[Admin API] Triggered message response task: ${handle.id}`);

    return NextResponse.json({
      success: true,
      taskId: handle.id,
      conversationId,
    });
  } catch (error) {
    console.error("[Admin API] Error sending message:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send message",
      },
      { status: 500 },
    );
  }
}
