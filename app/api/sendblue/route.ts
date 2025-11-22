import { createIncomingEvent, type NormalizedEvent } from "@/lib/events/schema";
import { handleMessage } from "@/trigger/tasks/handleMessage";
import { NextRequest, NextResponse } from "next/server";

// Optional webhook secret for verification
const WEBHOOK_SECRET = process.env.SENDBLUE_WEBHOOK_SECRET;

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "sendblue-webhook",
      message: "SendBlue webhook endpoint is active. Use POST to send events.",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

/**
 * POST handler - webhook events
 */
export async function POST(request: NextRequest) {
  console.log("[SendBlue][Webhook] POST request received");

  try {
    // Get the raw body
    const rawBody = await request.json();
    console.log("[SendBlue][Webhook] Raw body:", rawBody);

    // Optional: Verify webhook secret if configured
    // if (WEBHOOK_SECRET) {
    //   const providedSecret = request.headers.get("x-sendblue-signature");
    //   if (providedSecret !== WEBHOOK_SECRET) {
    //     console.error(
    //       "[SendBlue][Webhook] Unauthorized: Webhook secret mismatch",
    //     );
    //     return NextResponse.json(
    //       {
    //         error: "Unauthorized",
    //         message: "Invalid webhook signature",
    //       },
    //       { status: 401 },
    //     );
    //   }
    // }

    // Extract message data from SendBlue webhook
    const inboundMessage = rawBody.content;
    const fromNumber = rawBody.from_number;
    const toNumber = rawBody.to_number;
    const messageId = rawBody.message_handle;
    const status = rawBody.status;
    const mediaUrl = rawBody.media_url;

    // Determine event type based on webhook structure
    // SendBlue primarily sends inbound message webhooks
    // You may need to adjust this based on actual SendBlue webhook structure
    let eventType: "message_inbound" | "message_sent" | "message_failed" =
      "message_inbound";

    if (status === "DELIVERED") {
      eventType = "message_sent";
    } else if (status === "FAILED") {
      eventType = "message_failed";
    }

    // Normalize the SendBlue webhook data
    const normalized: NormalizedEvent = {
      sender: fromNumber,
      recipient: toNumber,
      text: inboundMessage,
      messageId: messageId,
      attachments: mediaUrl ? [mediaUrl] : undefined,
    };

    // Create the incoming event payload
    const incomingEvent = createIncomingEvent(
      "sendblue",
      eventType,
      normalized,
      rawBody,
    );

    console.log(
      "[SendBlue][Webhook] Normalized event:",
      JSON.stringify(incomingEvent, null, 2),
    );

    // Trigger the task for async processing
    const handle = await handleMessage.trigger(incomingEvent);

    console.log("[SendBlue][Webhook] Task triggered successfully:", handle.id);

    // Return success response
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[SendBlue][Webhook] Error processing webhook:", error);

    return NextResponse.json(
      {
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
