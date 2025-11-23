import { saveUserMessage } from "@/src/db/conversation";
import type {
  LoopWebhook,
  MessageInboundWebhook,
  MessageReactionWebhook,
} from "@/src/lib/loopmessage-sdk/types";
import { debouncedResponse } from "@/src/trigger/tasks/debouncedResponse";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
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

  // Save the message to the database with attachments
  await saveUserMessage(
    conversationId,
    webhook.text || "",
    webhook.recipient || "",
    webhook.message_id,
    isGroup,
    webhook.attachments || [],
  );

  // Trigger debounced response task
  await debouncedResponse.trigger({
    conversationId,
    recipient: webhook.recipient,
    group: webhook.group?.group_id,
    timestampWhenTriggered: new Date().toISOString(),
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
