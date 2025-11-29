import { saveUserMessage } from "@/src/db/conversation";
import { upsertUser, upsertUsers } from "@/src/db/user";
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

    console.log("Webhook received:", webhook);

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
    console.error("Error processing webhook:", error);
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

  // Validate recipient/participants
  if (isGroup && webhook.group?.participants) {
    // Validate all participants in group
    const validation = validateUserIdentifiers(webhook.group.participants);
    if (!validation.valid) {
      console.error(
        `Invalid participants in group message: ${validation.invalid.join(
          ", ",
        )}`,
      );
      throw new Error(
        `Invalid participant identifiers: ${validation.invalid.join(", ")}`,
      );
    }
    // For groups: upsert all participants
    await upsertUsers(webhook.group.participants);
  } else if (webhook.recipient) {
    // Validate recipient for DM
    if (!isValidUserIdentifier(webhook.recipient)) {
      console.error(`Invalid recipient identifier: ${webhook.recipient}`);
      throw new Error(
        `Invalid recipient identifier: ${webhook.recipient}. Must be a valid phone number (E.164) or email.`,
      );
    }
    // For DMs: upsert the sender
    await upsertUser(webhook.recipient);
  } else {
    // No recipient or group - reject
    console.error("Message has no recipient or group information");
    throw new Error("Message must have either a recipient or group");
  }

  // Save the message to the database with attachments and group info
  const savedMessage = await saveUserMessage(
    conversationId,
    webhook.text || "",
    webhook.recipient || "",
    webhook.message_id,
    isGroup,
    webhook.attachments || [],
    webhook.group?.name,
    webhook.group?.participants || [],
  );

  // Trigger debounced response task with the message timestamp
  // Use the DB timestamp to ensure accuracy
  await debouncedResponse.trigger({
    conversationId,
    recipient: webhook.recipient,
    group: webhook.group?.group_id,
    timestampWhenTriggered: savedMessage.createdAt.toISOString(),
  });

  return {
    typing: 3,
    read: true,
  };
}

async function inboundReactionHandler(
  webhook: MessageReactionWebhook,
): Promise<LoopInteractiveResponse> {
  console.log("Inbound reaction received:", webhook);

  return {
    read: true,
  };
}
