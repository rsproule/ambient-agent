import { type MessageAction } from "@/src/ai/respondToMessage";
import {
  releaseResponseLock,
  saveAssistantMessage,
  shouldInterrupt,
} from "@/src/db/conversation";
import { task, wait } from "@trigger.dev/sdk/v3";
import { LoopMessageService } from "loopmessage-sdk";

const client = new LoopMessageService({
  loopAuthKey: process.env.LOOP_AUTH_KEY!,
  loopSecretKey: process.env.LOOP_SECRET_KEY!,
  senderName: process.env.LOOP_SENDER_NAME!,
});

type HandleMessageResponsePayload = {
  conversationId: string; // phone number or group_id
  recipient?: string;
  group?: string;
  actions: MessageAction[];
  taskId: string; // Unique ID for this response task
};

export const handleMessageResponse = task({
  id: "handle-message-response",
  run: async (payload: HandleMessageResponsePayload) => {
    try {
      // Execute each action in sequence
      for (let i = 0; i < payload.actions.length; i++) {
        const action = payload.actions[i];

        // Check for interrupt before each action (except the first)
        if (i > 0) {
          const interrupted = await shouldInterrupt(
            payload.conversationId,
            payload.taskId,
          );
          if (interrupted) {
            console.log(
              `Response interrupted for conversation ${payload.conversationId}, stopping at action ${i}/${payload.actions.length}`,
            );
            return {
              interrupted: true,
              actionsCompleted: i,
              totalActions: payload.actions.length,
            };
          }
        }

        // Apply delay if specified
        if (action.delay) {
          await wait.for({ seconds: action.delay / 1000 });
        }

        await executeAction(action, payload);

        // Save assistant messages to the database
        if (action.type === "message") {
          await saveAssistantMessage(payload.conversationId, action.text);
        }
      }

      return {
        success: true,
        actionsCompleted: payload.actions.length,
      };
    } finally {
      // Always release the lock when done (success or failure)
      await releaseResponseLock(payload.conversationId, payload.taskId);
    }
  },
});

async function executeAction(
  action: MessageAction,
  payload: HandleMessageResponsePayload,
) {
  // Validate we have a recipient or group
  if (!payload.group && !payload.recipient) {
    throw new Error(
      `Invalid payload: must have either recipient or group specified. Conversation ID: ${payload.conversationId}`,
    );
  }

  // recipient and group are mutually exclusive - only include the one that's present
  const baseParams = payload.group
    ? { group: payload.group }
    : { recipient: payload.recipient! };

  console.log(
    `Executing ${action.type} action for conversation ${payload.conversationId}`,
    baseParams,
  );

  switch (action.type) {
    case "message":
      // Use appropriate method based on what's being sent
      if (action.reply_to_id) {
        await client.sendReply({
          ...baseParams,
          text: action.text,
          reply_to_id: action.reply_to_id,
          ...(action.attachments && action.attachments.length > 0 && { attachments: action.attachments }),
          effect: action.effect,
          subject: action.subject,
        });
      } else if (action.effect) {
        await client.sendMessageWithEffect({
          ...baseParams,
          text: action.text,
          effect: action.effect,
          ...(action.attachments && action.attachments.length > 0 && { attachments: action.attachments }),
          subject: action.subject,
        });
      } else {
        await client.sendLoopMessage({
          ...baseParams,
          text: action.text,
          ...(action.attachments && action.attachments.length > 0 && { attachments: action.attachments }),
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
