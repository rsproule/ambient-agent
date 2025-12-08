/**
 * Admin API: Check message status from LoopMessage API
 */

import prisma from "@/src/db/client";
import { requireAdmin } from "@/src/lib/auth/admin";
import { LoopMessageClient } from "@/src/lib/loopmessage-sdk/client";
import { NextRequest, NextResponse } from "next/server";

const loopClient = new LoopMessageClient({
  loopAuthKey: process.env.LOOP_AUTH_KEY!,
  loopSecretKey: process.env.LOOP_SECRET_KEY!,
  senderName: process.env.LOOP_SENDER_NAME!,
});

export async function GET(
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
    // Get the message from our database
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Only assistant messages have LoopMessage IDs
    if (message.role !== "assistant") {
      return NextResponse.json(
        { error: "Can only check status of assistant messages" },
        { status: 400 },
      );
    }

    // Check if we have a LoopMessage ID to query
    if (!message.messageId) {
      return NextResponse.json(
        { error: "Message does not have a LoopMessage ID" },
        { status: 400 },
      );
    }

    console.log(
      `[Admin API] Checking status for message ${messageId} (LoopMessage ID: ${message.messageId})`,
    );

    // Call the LoopMessage status API
    const statusResponse = await loopClient.getMessageStatus(message.messageId);

    // Optionally update our local record if status has changed
    if (
      statusResponse.status !== message.deliveryStatus &&
      ["sent", "failed", "timeout"].includes(statusResponse.status)
    ) {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          deliveryStatus: statusResponse.status as
            | "sent"
            | "failed"
            | "timeout"
            | "pending"
            | "scheduled",
        },
      });
      console.log(
        `[Admin API] Updated local message status from ${message.deliveryStatus} to ${statusResponse.status}`,
      );
    }

    return NextResponse.json({
      success: true,
      localMessageId: messageId,
      loopMessageId: message.messageId,
      status: statusResponse,
    });
  } catch (error) {
    console.error("[Admin API] Error checking message status:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to check message status",
      },
      { status: 500 },
    );
  }
}
