import { mrWhiskersAgent } from "@/src/ai/agents/mrWhiskers";
import { respondToMessage } from "@/src/ai/respondToMessage";
import {
  acquireResponseLock,
  getConversationMessages,
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
  machine: {
    preset: "medium-1x", // 1 vCPU, 2 GB RAM (increased for AI SDK + Anthropic)
  },
  run: async (payload: DebouncedResponsePayload, { ctx }) => {
    const taskId = ctx.run.id; // Unique ID for this task run

    // Wait 1 second (debounce period) to batch rapid messages
    await wait.for({ seconds: 1 });

    // Try to acquire the response lock (this prevents duplicate responses)
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

    // Get conversation history and context (last 100 messages)
    const { messages, context } = await getConversationMessages(
      payload.conversationId,
      100,
    );

    if (messages.length === 0) {
      console.log(
        `No messages found for conversation ${payload.conversationId}`,
      );
      return {
        skipped: true,
        reason: "no_messages",
      };
    }

    // Log conversation type and context
    console.log(
      `Conversation ${payload.conversationId} is a ${
        context.isGroup ? "GROUP CHAT" : "DIRECT MESSAGE"
      }`,
    );
    if (context.summary) {
      console.log(`Conversation has summary: ${context.summary}`);
    }

    // Generate AI response with full conversation context
    try {
      const actions = await respondToMessage(
        mrWhiskersAgent,
        messages,
        context,
      );

      // If no actions, we're done (e.g., group chat where no response is needed)
      if (actions.length === 0) {
        console.log(
          `No actions to execute for conversation ${payload.conversationId} (likely group chat silence)`,
        );
        await releaseResponseLock(payload.conversationId, taskId);
        return {
          success: true,
          actionsExecuted: 0,
          noResponseNeeded: true,
        };
      }

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
