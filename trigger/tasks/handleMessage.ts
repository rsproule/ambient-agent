import { DirectRespondAgent } from "@/lib/ai/agents/direct-respond";
import type { MessageContext } from "@/lib/ai/types";
import type { IncomingEventPayload } from "@/lib/events/schema";
import { Err, Ok, tryAsync } from "@/lib/result";
import { task } from "@trigger.dev/sdk/v3";
import { LoopMessageService } from "loopmessage-sdk";
import { SendblueAPI } from "sendblue";
import type { HandleMessageResult } from "./types";

/**
 * Handle Message Task
 *
 * Processes incoming message events from all sources and sends AI-generated responses.
 */

// Lazy client initialization
let loopService: LoopMessageService | null = null;
let sendblueClient: SendblueAPI | null = null;
let directRespondAgent: DirectRespondAgent | null = null;

function getLoopService(): LoopMessageService {
  if (!loopService) {
    loopService = new LoopMessageService({
      loopAuthKey: process.env.LOOP_AUTH_KEY!,
      loopSecretKey: process.env.LOOP_SECRET_KEY!,
      senderName: process.env.LOOP_SENDER_NAME!,
      logLevel: "info",
    });
  }
  return loopService;
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

function getDirectRespondAgent(): DirectRespondAgent {
  if (!directRespondAgent) {
    directRespondAgent = new DirectRespondAgent();
  }
  return directRespondAgent;
}

/**
 * Simple helper to decide if we should respond to a message
 */
function shouldRespond(messageText: string): boolean {
  // Skip empty messages
  if (!messageText?.trim()) {
    return false;
  }

  // Add your logic here - for now, respond to everything
  return true;
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

  // Quick decision: should we respond?
  if (!shouldRespond(messageText)) {
    return Ok({
      action: "skipped",
      reason: "decided_not_to_respond",
    });
  }

  // Create message context for AI
  const messageContext: MessageContext = {
    text: messageText,
    sender: sender || "unknown",
    groupId,
  };

  // Generate AI response
  const agent = getDirectRespondAgent();
  const aiResponse = await agent.respond(messageContext);
  const responseText = aiResponse.responseText;

  console.log("[HandleMessage][AI Response]", {
    responseText,
    reasoning: aiResponse.reasoning,
  });

  const loopService = getLoopService();

  // Send to group
  if (groupId) {
    const result = await tryAsync(() =>
      loopService.sendLoopMessage({
        group: groupId,
        text: responseText,
      }),
    );

    if (!result.ok) {
      return Err({
        code: "loop_send_failed",
        message: result.error.message,
      });
    }

    return Ok({
      action: "responded",
      data: {
        target: { type: "group", groupId },
        messageText: responseText,
        response: result.value,
      },
    });
  }

  // Send to individual
  if (sender) {
    const result = await tryAsync(() =>
      loopService.sendLoopMessage({
        recipient: sender,
        text: responseText,
      }),
    );

    if (!result.ok) {
      return Err({
        code: "loop_send_failed",
        message: result.error.message,
      });
    }

    return Ok({
      action: "responded",
      data: {
        target: { type: "individual", recipient: sender },
        messageText: responseText,
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

  // Quick decision: should we respond?
  if (!shouldRespond(messageText)) {
    return Ok({
      action: "skipped",
      reason: "decided_not_to_respond",
    });
  }

  // Create message context for AI
  const messageContext: MessageContext = {
    text: messageText,
    sender: fromNumber,
  };

  // Generate AI response
  const agent = getDirectRespondAgent();
  const aiResponse = await agent.respond(messageContext);
  const responseText = aiResponse.responseText;

  console.log("[HandleMessage][AI Response]", {
    responseText,
    reasoning: aiResponse.reasoning,
  });

  const client = getSendblueClient();

  // Send AI-generated response
  const result = await tryAsync(() =>
    client.messages.send({
      content: responseText,
      from_number: process.env.SENDBLUE_NUMBER!,
      number: fromNumber,
      send_style: "invisible",
    }),
  );

  if (!result.ok) {
    return Err({
      code: "sendblue_send_failed",
      message: result.error.message,
    });
  }

  return Ok({
    action: "responded",
    data: {
      target: { type: "individual", recipient: fromNumber },
      messageText: responseText,
      response: result.value,
    },
  });
}
