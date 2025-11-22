import type { LoopWebhook } from "@/lib/loop";
import {
  createWebhookResponse,
  parseLoopWebhook,
  validateWebhookAuth,
} from "@/lib/loop";
import { createIncomingEvent, type IncomingEventPayload, type EventType, type NormalizedEvent } from "@/lib/events/schema";
import { handleMessage } from "@/trigger/tasks/handleMessage";
import { NextRequest, NextResponse } from "next/server";

const EXPECTED_BEARER_TOKEN = process.env.LOOP_WEBHOOK_SECRET_KEY!;

/**
 * Normalize a LoopMessage webhook into our unified event format
 */
function normalizeLoopWebhook(webhook: LoopWebhook): {
  type: EventType;
  normalized: NormalizedEvent;
} {
  const baseNormalized: NormalizedEvent = {
    passthrough: webhook.passthrough,
  };

  switch (webhook.alert_type) {
    case "message_inbound":
      return {
        type: "message_inbound",
        normalized: {
          ...baseNormalized,
          sender: webhook.recipient, // In LoopMessage, sender is in 'recipient' field
          text: webhook.text,
          groupId: webhook.group_id,
          messageType: webhook.message_type,
          speechText: webhook.speech?.text,
          attachments: webhook.attachments,
          replyToId: webhook.reply_to_id,
        },
      };

    case "message_sent":
      return {
        type: "message_sent",
        normalized: {
          ...baseNormalized,
          messageId: webhook.message_id,
          recipient: webhook.recipient,
          groupId: webhook.group_id,
          text: webhook.text,
        },
      };

    case "message_failed":
      return {
        type: "message_failed",
        normalized: {
          ...baseNormalized,
          messageId: webhook.message_id,
          recipient: webhook.recipient,
          groupId: webhook.group_id,
          text: webhook.text,
          errorCode: webhook.error_code,
          errorMessage: webhook.error_message,
        },
      };

    case "message_reaction":
      return {
        type: "message_reaction",
        normalized: {
          ...baseNormalized,
          messageId: webhook.message_id,
          recipient: webhook.recipient,
          reaction: webhook.reaction,
          sender: webhook.from,
        },
      };

    case "message_typing":
      return {
        type: "message_typing",
        normalized: {
          ...baseNormalized,
          sender: webhook.from,
          recipient: webhook.recipient,
        },
      };

    case "message_read":
      return {
        type: "message_read",
        normalized: {
          ...baseNormalized,
          messageId: webhook.message_id,
          sender: webhook.from,
          recipient: webhook.recipient,
        },
      };

    case "auth_response":
      return {
        type: "auth_response",
        normalized: {
          ...baseNormalized,
          requestId: webhook.request_id,
          recipient: webhook.recipient,
        },
      };

    case "group_created":
      return {
        type: "group_created",
        normalized: {
          ...baseNormalized,
          groupId: webhook.group_id,
          groupName: webhook.group_name,
          participants: webhook.participants,
          creator: webhook.creator,
        },
      };

    default:
      // This shouldn't happen due to discriminated union, but TypeScript requires it
      throw new Error(`Unknown webhook type: ${(webhook as any).alert_type}`);
  }
}

// GET handler - for webhook verification or status check
export async function GET() {
  console.log("[LoopMessage][Webhook] GET request to webhook endpoint");
  return NextResponse.json(
    {
      status: "ok",
      service: "loopmessage-webhook",
      message: "Webhook endpoint is active. Use POST to send webhooks.",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

// POST handler - for webhook events
export async function POST(request: NextRequest) {
  console.log("[LoopMessage][Webhook] POST request received");

  try {
    // Get the raw body
    const rawBody = await request.text();
    console.log("[LoopMessage][Webhook] Raw body:", rawBody);

    // Verify bearer token
    const authorizationHeader = request.headers.get("authorization");
    console.log("[LoopMessage][Webhook] Authorization header:", authorizationHeader);

    if (!validateWebhookAuth(authorizationHeader, EXPECTED_BEARER_TOKEN)) {
      console.error("[LoopMessage][Webhook] Unauthorized: Bearer token mismatch or missing");
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Invalid or missing bearer token",
        },
        { status: 401 },
      );
    }

    console.log("[LoopMessage][Webhook] Authorized. Processing payload...");

    // Parse and validate the webhook payload with Zod
    const webhook = parseLoopWebhook(rawBody);

    console.log("[LoopMessage][Webhook] Payload type:", webhook.alert_type);
    console.log("[LoopMessage][Webhook] Full payload:", JSON.stringify(webhook, null, 2));

    // Normalize the webhook into our unified event format
    const { type, normalized } = normalizeLoopWebhook(webhook);

    // Create the incoming event payload
    const incomingEvent: IncomingEventPayload = createIncomingEvent(
      "loopmessage",
      type,
      normalized,
      webhook,
      webhook.passthrough,
    );

    console.log("[LoopMessage][Webhook] Normalized event:", JSON.stringify(incomingEvent, null, 2));

    // Trigger the task for async processing
    const handle = await handleMessage.trigger(incomingEvent);

    console.log("[LoopMessage][Webhook] Task triggered successfully:", handle.id);

    // Respond immediately with typing indicator
    return NextResponse.json(createWebhookResponse(), { status: 200 });
  } catch (error) {
    console.error("[LoopMessage][Webhook Error]", error);

    return NextResponse.json(
      {
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
