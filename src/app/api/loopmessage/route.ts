import { saveReactionMessage, saveUserMessage } from "@/src/db/conversation";
import { upsertUser, upsertUsers } from "@/src/db/user";
import logger, { createContextLogger } from "@/src/lib/logger";
import {
  LoopWebhookSchema,
  type MessageFailedWebhook,
  type MessageInboundWebhook,
  type MessageReactionWebhook,
  type MessageSentWebhook,
  type MessageTimeoutWebhook,
} from "@/src/lib/loopmessage-sdk/webhooks";
import {
  isValidUserIdentifier,
  validateUserIdentifiers,
} from "@/src/lib/validation/userValidation";
import { debouncedResponse } from "@/src/trigger/tasks/debouncedResponse";
import { NextResponse } from "next/server";

/**
 * LoopMessage error codes and their meanings
 * https://docs.loopmessage.com/webhooks
 */
const LOOPMESSAGE_ERROR_CODES: Record<number, string> = {
  100: "Bad request",
  110: "Missing credentials in request",
  120: "One or more required parameters for the request are missing",
  125: "Authorization key is invalid or does not exist",
  130: "Secret key is invalid or does not exist",
  140: "No 'text' parameter in request",
  150: "No 'recipient' parameter in request",
  160: "Invalid recipient",
  170: "Invalid recipient email",
  180: "Invalid recipient phone number",
  190: "A phone number is not mobile",
  210: "Sender name not specified in request parameters",
  220: "Invalid sender name",
  230: "An internal error occurred while trying to use the specified sender name",
  240: "Sender name is not activated or unpaid",
  270: "This recipient blocked any type of messages",
  300: "Unable to send this type of message without dedicated sender name",
  330: "You send messages too frequently to recipients you haven't contacted for a long time",
  400: "No available requests/credits on your balance",
  500: "Your account is suspended",
  510: "Your account is blocked",
  530: "Your account is suspended due to debt",
  540: "No active purchased sender name to send message",
  545: "Your sender name has been suspended by Apple",
  550: "Requires a dedicated sender name or need to add this recipient as sandbox contact",
  560: "Unable to send outbound messages until this recipient initiates a conversation with your sender",
  570: "This API request is deprecated and not supported",
  580: "Invalid effect parameter",
  590: "Invalid message_id for reply",
  595: "Invalid or non-existent message_id",
  600: "Invalid reaction parameter",
  610: "Reaction or message_id is invalid or does not exist",
  620: "Unable to use effect and reaction parameters in the same request",
  630: "Need to set up a vCard file for this sender name in the dashboard",
  640: "No media file URL - media_url",
  1110: "Unable to send SMS if the recipient is an email address",
  1120: "Unable to send SMS if the recipient is group",
  1130: "Unable to send SMS with marketing content",
  1140: "Unable to send audio messages through SMS",
};

export async function POST(request: Request) {
  let rawWebhook: unknown;

  try {
    rawWebhook = await request.json();

    // Validate webhook structure with Zod
    const webhook = LoopWebhookSchema.parse(rawWebhook);

    // Extract trace info for logging
    const msgId = webhook.message_id;
    const groupId = "group" in webhook ? webhook.group?.group_id : undefined;
    const sender = webhook.recipient;

    const log = createContextLogger({
      component: "loopmessage",
      msgId,
      groupId,
      sender,
    });

    log.info("Webhook received", webhook);

    switch (webhook.alert_type) {
      case "message_inbound":
        return NextResponse.json(await inboundMessageHandler(webhook), {
          status: 200,
        });
      case "message_reaction":
        return NextResponse.json(await inboundReactionHandler(webhook), {
          status: 200,
        });
      case "message_failed":
        handleMessageFailed(webhook);
        return NextResponse.json({ status: 200 });
      case "message_sent":
        handleMessageSent(webhook);
        return NextResponse.json({ status: 200 });
      case "message_timeout":
        handleMessageTimeout(webhook);
        return NextResponse.json({ status: 200 });
      default:
        log.info("Unhandled webhook type", { alert_type: webhook.alert_type });
        break;
    }

    return NextResponse.json({ status: 200 });
  } catch (error) {
    // Handle Zod validation errors specially
    if (error instanceof Error && error.name === "ZodError") {
      logger.error("Invalid webhook structure", {
        error: error.message,
        rawWebhook,
        component: "loopmessage",
      });
      return NextResponse.json(
        {
          error: "Invalid webhook structure",
          details: error.message,
        },
        { status: 400 },
      );
    }

    logger.error("Error processing webhook", {
      error,
      rawWebhook,
      component: "loopmessage",
    });
    return NextResponse.json(
      {
        error: "Invalid webhook data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}

type LoopInteractiveResponse = {
  typing?: number;
  read?: boolean;
};

async function inboundMessageHandler(
  webhook: MessageInboundWebhook,
): Promise<LoopInteractiveResponse> {
  // Determine conversation identifier (phone number or group_id)
  const conversationId = webhook.group?.group_id || webhook.recipient || "";
  const isGroup = !!webhook.group;
  const sender = webhook.recipient || "";
  let isNewUser = false;

  const log = createContextLogger({
    component: "inboundMessage",
    msgId: webhook.message_id,
    groupId: webhook.group?.group_id,
    sender,
    conversationId,
  });

  log.info("Processing inbound message", { isGroup });

  // Validate recipient/participants
  if (isGroup && webhook.group?.participants) {
    // Validate all participants in group
    const validation = validateUserIdentifiers(webhook.group.participants);
    if (!validation.valid) {
      log.error("Invalid participants in group message", {
        invalid: validation.invalid,
      });
      throw new Error(
        `Invalid participant identifiers: ${validation.invalid.join(", ")}`,
      );
    }
    // For groups: upsert all participants
    await upsertUsers(webhook.group.participants);
  } else if (webhook.recipient) {
    // Validate recipient for DM
    if (!isValidUserIdentifier(webhook.recipient)) {
      log.error("Invalid recipient identifier");
      throw new Error(
        `Invalid recipient identifier: ${webhook.recipient}. Must be a valid phone number (E.164) or email.`,
      );
    }
    // For DMs: upsert the sender and check if new
    const result = await upsertUser(webhook.recipient);
    isNewUser = result.isNewUser;

    if (isNewUser) {
      log.info("New user detected");
    }
  } else {
    // No recipient or group - reject
    log.error("Message has no recipient or group information");
    throw new Error("Message must have either a recipient or group");
  }

  // Save the message to the database with attachments and group info
  log.info("Saving message to DB");
  const savedMessage = await saveUserMessage(
    conversationId,
    webhook.text || "",
    sender,
    webhook.message_id,
    isGroup,
    webhook.attachments || [],
    webhook.group?.name,
    webhook.group?.participants || [],
  );
  log.info("Message saved", { messageId: savedMessage.id });

  // Trigger debounced response task with the message timestamp
  log.info("Triggering debounced response");
  await debouncedResponse.trigger({
    conversationId,
    recipient: webhook.recipient,
    group: webhook.group?.group_id,
    timestampWhenTriggered: savedMessage.createdAt.toISOString(),
    isNewUser: isNewUser && !isGroup,
  });

  return {
    typing: 6,
    read: true,
  };
}

async function inboundReactionHandler(
  webhook: MessageReactionWebhook,
): Promise<LoopInteractiveResponse> {
  const sender = webhook.recipient || "";
  const targetMessageId = webhook.message_id;
  const reaction = webhook.reaction;

  const log = createContextLogger({
    component: "inboundReaction",
    msgId: targetMessageId,
    sender,
  });

  log.info("Inbound reaction received", { reaction, targetMessageId });

  // Validate sender
  if (!sender || !isValidUserIdentifier(sender)) {
    log.error("Invalid sender for reaction");
    return { read: true };
  }

  // Upsert the user who sent the reaction
  await upsertUser(sender);

  // Determine conversation ID - for reactions, we use the sender's phone as conversation ID
  // (reactions are typically in DMs, but we handle groups via recipient field)
  const conversationId = sender;
  const isGroup = false; // Reactions don't include group info in webhook

  // Save the reaction as a message
  log.info("Saving reaction to DB");
  const savedMessage = await saveReactionMessage(
    conversationId,
    reaction,
    targetMessageId,
    sender,
    isGroup,
  );
  log.info("Reaction saved", { messageId: savedMessage.id });

  // Trigger debounced response - AI will decide whether to respond
  log.info("Triggering debounced response for reaction");
  await debouncedResponse.trigger({
    conversationId,
    recipient: sender,
    group: undefined,
    timestampWhenTriggered: savedMessage.createdAt.toISOString(),
    isNewUser: false,
  });

  return {
    read: true,
  };
}

/**
 * Handle message_failed webhook - message could not be delivered at all
 *
 * This happens when:
 * - Recipient is an Android user (can't receive iMessage)
 * - Invalid phone number or email
 * - Other delivery failures
 */
function handleMessageFailed(webhook: MessageFailedWebhook): void {
  const errorDescription =
    LOOPMESSAGE_ERROR_CODES[webhook.error_code] || "Unknown error code";

  const log = createContextLogger({
    component: "loopmessage-delivery-failure",
    msgId: webhook.message_id,
    sender: webhook.recipient,
  });

  log.error(`MESSAGE DELIVERY FAILED: ${errorDescription}`, {
    error_code: webhook.error_code,
    recipient: webhook.recipient,
    message_id: webhook.message_id,
  });
}

/**
 * Handle message_sent webhook - check if delivery actually succeeded
 */
function handleMessageSent(webhook: MessageSentWebhook): void {
  const log = createContextLogger({
    component: "loopmessage-delivery",
    msgId: webhook.message_id,
    sender: webhook.recipient,
  });

  const isReaction = !!webhook.reaction;

  if (webhook.success === false) {
    log.error("MESSAGE SENT BUT NOT DELIVERED", {
      success: false,
      delivery_type: webhook.delivery_type,
      recipient: webhook.recipient,
      message_id: webhook.message_id,
      reaction: webhook.reaction,
    });
  } else {
    log.info(isReaction ? "Reaction sent" : "Message delivered", {
      success: webhook.success,
      delivery_type: webhook.delivery_type,
      recipient: webhook.recipient,
      message_id: webhook.message_id,
      reaction: webhook.reaction,
      reaction_event: webhook.reaction_event,
    });
  }
}

/**
 * Handle message_timeout webhook - message delivery timed out
 *
 * This happens when:
 * - A timeout parameter was passed in the send request
 * - The message could not be delivered within that time
 */
function handleMessageTimeout(webhook: MessageTimeoutWebhook): void {
  const errorDescription =
    LOOPMESSAGE_ERROR_CODES[webhook.error_code] || "Timeout error";

  const log = createContextLogger({
    component: "loopmessage-delivery-timeout",
    msgId: webhook.message_id,
    sender: webhook.recipient,
  });

  log.error("MESSAGE DELIVERY TIMED OUT", {
    alert_type: "message_timeout",
    error_code: webhook.error_code,
    error_description: errorDescription,
    recipient: webhook.recipient,
    message_id: webhook.message_id,
    text_preview: webhook.text?.substring(0, 100),
    passthrough: webhook.passthrough,
    full_webhook: webhook,
  });

  log.error(
    "TIMEOUT - Failed to deliver message within the specified timeout period",
    {
      recipient: webhook.recipient,
      possible_causes: [
        "Recipient's device is offline",
        "Poor network conditions",
        "iMessage server delays",
        "Timeout value was too short",
      ],
      suggestion:
        "Consider increasing timeout value or implementing retry logic",
    },
  );
}
