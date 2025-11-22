import type { IncomingEventPayload } from "@/lib/events/schema";
import { LoopClient } from "@/lib/loop/client";
import { Err, Ok, tryAsync } from "@/lib/result";
import { task } from "@trigger.dev/sdk/v3";
import { SendblueAPI } from "sendblue";
import type { HandleMessageResult } from "./types";

/**
 * Handle Message Task
 *
 * Processes incoming message events from all sources and echoes them back.
 */

// Lazy client initialization
let loopClient: LoopClient | null = null;
let sendblueClient: SendblueAPI | null = null;

function getLoopClient(): LoopClient {
  if (!loopClient) {
    loopClient = new LoopClient({
      loopAuthKey: process.env.LOOP_AUTH_KEY!,
      loopSecretKey: process.env.LOOP_SECRET_KEY!,
      senderName: process.env.LOOP_SENDER_NAME!,
      logLevel: "info",
    });
  }
  return loopClient;
}

function getSendblueClient(): SendblueAPI {
  if (!sendblueClient) {
    sendblueClient = new SendblueAPI({
      apiKey: process.env.SENDBLUE_API_KEY!,
      apiSecret: process.env.SENDBLUE_API_SECRET!,
    });
  }
  return sendblueClient;
}

export const handleMessage = task({
  id: "handle-message",
  run: async (payload: IncomingEventPayload): Promise<HandleMessageResult> => {
    console.log("[HandleMessage] Processing event:", {
      source: payload.source,
      type: payload.type,
      timestamp: payload.timestamp,
    });

    // Only process inbound messages
    if (payload.type !== "message_inbound") {
      return Ok({
        action: "skipped",
        reason: "not_inbound_message",
      });
    }

    const { normalized } = payload;

    // Validate message text exists
    if (!normalized.text?.trim()) {
      return Ok({
        action: "skipped",
        reason: "no_message_text",
      });
    }

    // Route based on source
    if (payload.source === "loopmessage") {
      return await handleLoopMessage(normalized);
    }

    if (payload.source === "sendblue") {
      return await handleSendblueMessage(normalized);
    }

    return Err({
      code: "unknown_source",
      message: `Unknown source: ${payload.source}`,
    });
  },
});

async function handleLoopMessage(
  normalized: IncomingEventPayload["normalized"],
): Promise<HandleMessageResult> {
  const sender = normalized.sender;
  const messageText = normalized.text!;
  const groupId = normalized.groupId;

  console.log("[HandleMessage][LoopMessage]", {
    sender,
    groupId,
    messageText,
  });

  const client = getLoopClient();

  // Send to group
  if (groupId) {
    const result = await tryAsync(() =>
      client.sendMessage({
        group: groupId,
        text: messageText,
      }),
    );

    if (!result.ok) {
      return Err({
        code: "loop_send_failed",
        message: result.error.message,
      });
    }

    return Ok({
      action: "echoed",
      data: {
        target: { type: "group", groupId },
        messageText,
        response: result.value,
      },
    });
  }

  // Send to individual
  if (sender) {
    const result = await tryAsync(() =>
      client.sendMessage({
        recipient: sender,
        text: messageText,
      }),
    );

    if (!result.ok) {
      return Err({
        code: "loop_send_failed",
        message: result.error.message,
      });
    }

    return Ok({
      action: "echoed",
      data: {
        target: { type: "individual", recipient: sender },
        messageText,
        response: result.value,
      },
    });
  }

  return Ok({
    action: "skipped",
    reason: "no_sender_or_group",
  });
}

async function handleSendblueMessage(
  normalized: IncomingEventPayload["normalized"],
): Promise<HandleMessageResult> {
  const fromNumber = normalized.sender;
  const messageText = normalized.text!;

  console.log("[HandleMessage][SendBlue]", { fromNumber, messageText });

  if (!fromNumber) {
    return Ok({
      action: "skipped",
      reason: "no_sender_or_group",
    });
  }

  const client = getSendblueClient();

  // Echo the message back
  const result = await tryAsync(() =>
    client.messages.send({
      content: messageText,
      from_number: process.env.SENDBLUE_NUMBER!,
      number: fromNumber,
      send_style: "echo",
    }),
  );

  if (!result.ok) {
    return Err({
      code: "sendblue_send_failed",
      message: result.error.message,
    });
  }

  return Ok({
    action: "echoed",
    data: {
      target: { type: "individual", recipient: fromNumber },
      messageText,
      response: result.value,
    },
  });
}
