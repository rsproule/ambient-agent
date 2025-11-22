import { respondToMessage } from "@/src/ai/respondToMessage";
import {
  acquireResponseLock,
  getConversationMessages,
  hasNewMessagesSince,
  releaseResponseLock,
} from "@/src/db/conversation";
import { task, wait } from "@trigger.dev/sdk/v3";
import { handleMessageResponse } from "./handleMessage";

type DebouncedResponsePayload = {
  conversationId: string; // phone number or group_id
  recipient?: string; // for 1:1 chats
  group?: string; // for group chats
  timestampWhenTriggered: string; // ISO string of when this task was triggered
};

export const debouncedResponse = task({
  id: "debounced-response",
  run: async (payload: DebouncedResponsePayload, { ctx }) => {
    const triggerTime = new Date(payload.timestampWhenTriggered);
    const taskId = ctx.run.id; // Unique ID for this task run

    // Wait 1 second (debounce period)
    await wait.for({ seconds: 1 });

    // Check if any new messages arrived during the debounce period
    const hasNewMessages = await hasNewMessagesSince(
      payload.conversationId,
      triggerTime,
    );

    if (hasNewMessages) {
      console.log(
        `New messages detected for conversation ${payload.conversationId}, skipping response`,
      );
      return {
        skipped: true,
        reason: "new_messages_received",
      };
    }

    // Try to acquire the response lock
    const lockAcquired = await acquireResponseLock(
      payload.conversationId,
      taskId,
    );

    if (!lockAcquired) {
      console.log(
        `Another response is active for conversation ${payload.conversationId}, interrupting it and waiting`,
      );
      // Wait for the interrupt to take effect (give it 2 seconds max)
      await wait.for({ seconds: 2 });

      // Try to acquire lock again
      const retryLock = await acquireResponseLock(
        payload.conversationId,
        taskId,
      );
      if (!retryLock) {
        console.log(
          `Could not acquire lock for conversation ${payload.conversationId}, giving up`,
        );
        return {
          skipped: true,
          reason: "lock_acquisition_failed",
        };
      }
    }

    // Lock acquired, safe to respond
    console.log(
      `Responding to conversation ${payload.conversationId} after debounce`,
    );

    // Get conversation history (last 100 messages)
    const messages = await getConversationMessages(payload.conversationId, 100);

    if (messages.length === 0) {
      console.log(
        `No messages found for conversation ${payload.conversationId}`,
      );
      return {
        skipped: true,
        reason: "no_messages",
      };
    }

    // Generate AI response with full conversation context
    try {
      const actions = await respondToMessage(messages);

      // Execute the actions via the existing handleMessageResponse
      await handleMessageResponse.triggerAndWait({
        conversationId: payload.conversationId,
        recipient: payload.recipient,
        group: payload.group,
        actions,
        taskId,
      });

      return {
        success: true,
        actionsExecuted: actions.length,
      };
    } catch (error) {
      // Release lock on error
      await releaseResponseLock(payload.conversationId, taskId);
      throw error;
    }
  },
});
