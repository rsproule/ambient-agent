import type {
  LoopWebhook,
  MessageInboundWebhook,
  MessageReactionWebhook,
} from "@/src/lib/loopmessage-sdk/types";
import { handleMessageResponse } from "@/src/trigger/tasks/handleMessage";
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
  await handleMessageResponse.trigger({
    message: webhook.text || "",
    recipient: webhook.recipient || "",
    message_id: webhook.message_id,
    group: webhook.group?.group_id,
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
