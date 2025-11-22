import type { LoopWebhook } from "@/src/lib/loopmessage-sdk/types";
import { handleMessageResponse } from "@/src/trigger/tasks/handleMessage";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const webhook = (await request.json()) as LoopWebhook;

  console.log("Webhook received:", webhook);

  const shouldRespond = webhook.alert_type === "message_inbound";
  if (shouldRespond) {
    const job = await handleMessageResponse.trigger({
      message: webhook.text || "",
      recipient: webhook.recipient || "",
    });

    console.log("Job triggered:", job);
    return NextResponse.json({ typing: 3, read: true }, { status: 200 });
  }

  return NextResponse.json({ status: 200 });
}
