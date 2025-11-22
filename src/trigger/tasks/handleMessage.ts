import {
  respondToMessage,
  type MessageAction,
} from "@/src/ai/respondToMessage";
import { task, wait } from "@trigger.dev/sdk/v3";
import { LoopMessageService } from "loopmessage-sdk";

const client = new LoopMessageService({
  loopAuthKey: process.env.LOOP_AUTH_KEY!,
  loopSecretKey: process.env.LOOP_SECRET_KEY!,
  senderName: process.env.LOOP_SENDER_NAME!,
});

type HandleMessageResponsePayload = {
  message: string;
  recipient: string;
  message_id?: string;
  group?: string;
  attachments?: string[];
};

export const handleMessageResponse = task({
  id: "handle-message-response",
  run: async (payload: HandleMessageResponsePayload) => {
    // Generate AI response with actions
    const actions = await respondToMessage(payload.message, {
      message_id: payload.message_id,
      attachments: payload.attachments,
    });

    // Execute each action in sequence
    for (const action of actions) {
      // Apply delay if specified
      if (action.delay) {
        await wait.for({ seconds: action.delay / 1000 });
      }

      await executeAction(action, payload);
    }
  },
});

async function executeAction(
  action: MessageAction,
  payload: HandleMessageResponsePayload,
) {
  // recipient and group are mutually exclusive - only include the one that's present
  const baseParams = payload.group
    ? { group: payload.group }
    : { recipient: payload.recipient };

  switch (action.type) {
    case "message":
      // Use appropriate method based on what's being sent
      if (action.reply_to_id) {
        await client.sendReply({
          ...baseParams,
          text: action.text,
          reply_to_id: action.reply_to_id,
          attachments: action.attachments,
          effect: action.effect,
          subject: action.subject,
        });
      } else if (action.effect) {
        await client.sendMessageWithEffect({
          ...baseParams,
          text: action.text,
          effect: action.effect,
          attachments: action.attachments,
          subject: action.subject,
        });
      } else {
        await client.sendLoopMessage({
          ...baseParams,
          text: action.text,
          attachments: action.attachments,
          subject: action.subject,
        });
      }
      break;

    case "reaction":
      await client.sendReaction({
        ...baseParams,
        text: "Reaction", // Required by SDK validation but ignored by API for reactions
        message_id: action.message_id,
        reaction: action.reaction,
      });
      break;
  }
}
