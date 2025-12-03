import { saveReactionMessage, saveUserMessage } from "@/src/db/conversation";
import { upsertUser, upsertUsers } from "@/src/db/user";
import logger, { createContextLogger } from "@/src/lib/logger";
import type {
  LoopWebhook,
  MessageInboundWebhook,
  MessageReactionWebhook,
} from "@/src/lib/loopmessage-sdk/types";
import {
  isValidUserIdentifier,
  validateUserIdentifiers,
} from "@/src/lib/validation/userValidation";
import { debouncedResponse } from "@/src/trigger/tasks/debouncedResponse";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const webhook = (await request.json()) as LoopWebhook;

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
      default:
        break;
    }

    return NextResponse.json({ status: 200 });
  } catch (error) {
    logger.error("Error processing webhook", {
      error,
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
    typing: 3,
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
