import {
  isCurrentGeneration,
  releaseResponseLock,
  saveAssistantMessage,
} from "@/src/db/conversation";
import { LoopMessageClient } from "@/src/lib/loopmessage-sdk/client";
import { type MessageAction } from "@/src/lib/loopmessage-sdk/message-actions";
import { task, wait } from "@trigger.dev/sdk/v3";

const client = new LoopMessageClient({
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
  sender?: string; // For group chats: the sender phone number (for per-sender locking)
  isGroup?: boolean; // Whether this is a group chat
};

export const handleMessageResponse = task({
  id: "handle-message-response",
  machine: {
    preset: "small-1x", // 0.5 vCPU, 0.5 GB RAM
  },
  run: async (payload: HandleMessageResponsePayload) => {
    try {
      // Execute each action in sequence
      for (let i = 0; i < payload.actions.length; i++) {
        const action = payload.actions[i];

        // Check for interrupt before each action (except the first)
        // Note: Group chats with per-sender locking don't use interrupts
        if (i > 0) {
          const isCurrent = await isCurrentGeneration(
            payload.conversationId,
            payload.taskId,
            payload.sender,
            payload.isGroup,
          );
          if (!isCurrent) {
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
      await releaseResponseLock(
        payload.conversationId,
        payload.taskId,
        payload.sender,
        payload.isGroup,
      );
    }
  },
});

/**
 * Validate and filter attachments for LoopMessage
 * - Must be HTTPS URLs
 * - Max 256 characters
 * - Max 3 attachments
 */
function filterValidAttachments(attachments?: string[]): string[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;

  const valid = attachments
    .filter((url) => {
      if (!url || typeof url !== "string") return false;
      if (!url.startsWith("https://")) {
        console.warn(`[handleMessage] Skipping non-HTTPS attachment: ${url}`);
        return false;
      }
      if (url.length > 256) {
        console.warn(`[handleMessage] Skipping attachment URL > 256 chars`);
        return false;
      }
      return true;
    })
    .slice(0, 3); // Max 3 attachments

  return valid.length > 0 ? valid : undefined;
}

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
    action,
  );

  switch (action.type) {
    case "message":
      // Filter attachments to only valid HTTPS URLs
      const validAttachments = filterValidAttachments(action.attachments);

      // Use appropriate method based on what's being sent
      if (action.reply_to_id) {
        await client.sendReply({
          ...baseParams,
          text: action.text,
          reply_to_id: action.reply_to_id,
          ...(validAttachments && { attachments: validAttachments }),
          effect: action.effect,
          subject: action.subject,
        });
      } else if (action.effect) {
        await client.sendMessageWithEffect({
          ...baseParams,
          text: action.text,
          effect: action.effect,
          ...(validAttachments && { attachments: validAttachments }),
          subject: action.subject,
        });
      } else {
        await client.sendLoopMessage({
          ...baseParams,
          text: action.text,
          ...(validAttachments && { attachments: validAttachments }),
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
