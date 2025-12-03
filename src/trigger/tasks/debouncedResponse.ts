import { mrWhiskersAgent } from "@/src/ai/agents/mrWhiskers";
import { respondToMessage } from "@/src/ai/respondToMessage";
import {
  acquireResponseLock,
  getConversationMessages,
  releaseResponseLock,
} from "@/src/db/conversation";
import { createContextLogger } from "@/src/lib/logger";
import { task, wait } from "@trigger.dev/sdk/v3";
import { LoopMessageService } from "loopmessage-sdk";
import { handleMessageResponse } from "./handleMessage";

// Create LoopMessage client for sending quick notifications
const loopClient = new LoopMessageService({
  loopAuthKey: process.env.LOOP_AUTH_KEY!,
  loopSecretKey: process.env.LOOP_SECRET_KEY!,
  senderName: process.env.LOOP_SENDER_NAME!,
});

/**
 * Tool-specific loading messages
 * Each tool maps to an array of possible messages to randomly choose from
 */
const TOOL_LOADING_MESSAGES: Record<string, string[]> = {
  // Search tools
  "websearch-perplexity": [
    "let me look that up...",
    "searching...",
    "checking on that...",
  ],

  // Image generation
  createImage: ["one sec...", "creating that...", "working on it..."],

  // Calendar tools
  getCalendarEvents: [
    "checking your calendar...",
    "looking at your schedule...",
  ],
  createCalendarEvent: [
    "adding that to your calendar...",
    "scheduling that...",
  ],

  // Gmail tools
  getEmails: ["checking your inbox...", "looking through your emails..."],
  sendEmail: ["sending that...", "drafting your email..."],

  // GitHub tools
  getGitHubNotifications: [
    "checking github...",
    "looking at your notifications...",
  ],
  getGitHubPullRequests: [
    "checking your PRs...",
    "looking at pull requests...",
  ],

  // Research tools
  requestResearch: ["digging into that...", "researching..."],

  // Context tools
  getUserContext: ["let me recall...", "thinking..."],
  updateUserContext: ["noted...", "got it..."],

  // Connection tools
  generateConnectionLink: ["getting that link...", "one moment..."],

  // Scheduled jobs
  createScheduledJob: ["scheduling that...", "setting that up..."],
  listScheduledJobs: [
    "checking your reminders...",
    "looking at scheduled items...",
  ],

  // Default fallback
  _default: ["one sec...", "let me check...", "working on it..."],
};

/**
 * Get a random loading message for the given tools
 */
function getLoadingMessage(toolNames: string[]): string {
  // Try to find a specific message for the first tool
  for (const toolName of toolNames) {
    const messages = TOOL_LOADING_MESSAGES[toolName];
    if (messages && messages.length > 0) {
      return messages[Math.floor(Math.random() * messages.length)];
    }
  }
  // Fall back to default messages
  const defaultMessages = TOOL_LOADING_MESSAGES._default;
  return defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
}

type DebouncedResponsePayload = {
  conversationId: string; // phone number or group_id
  recipient?: string; // for 1:1 chats
  group?: string; // for group chats
  timestampWhenTriggered: string; // ISO string of when this task was triggered
  isNewUser?: boolean; // whether this is a brand new user (for onboarding)
};

export const debouncedResponse = task({
  id: "debounced-response",
  machine: {
    preset: "medium-1x", // 1 vCPU, 2 GB RAM (increased for AI SDK + Anthropic)
  },
  run: async (payload: DebouncedResponsePayload, { ctx }) => {
    const taskId = ctx.run.id; // Unique ID for this task run
    const isGroup = !!payload.group;
    // For group chats, recipient is the sender of the message
    const sender = isGroup ? payload.recipient : undefined;

    // Wait 1 second (debounce period) to batch rapid messages
    await wait.for({ seconds: 1 });

    // Try to acquire the response lock
    // For DMs: conversation-level lock (prevents duplicate responses)
    // For Group Chats: per-sender lock (allows parallel responses from different senders)
    const lockAcquired = await acquireResponseLock(
      payload.conversationId,
      taskId,
      sender,
      isGroup,
    );

    const log = createContextLogger({
      component: "debouncedResponse",
      conversationId: payload.conversationId,
      groupId: payload.group,
      sender,
    });

    if (!lockAcquired) {
      // For group chats, if we can't acquire lock for this sender, just skip
      // (their previous message is still being processed)
      if (isGroup) {
        log.info("Sender already has active response, skipping duplicate");
        return {
          skipped: true,
          reason: "sender_response_in_progress",
        };
      }

      // For DMs: try to interrupt and retry
      log.info("Another response is active, interrupting and waiting");
      // Wait for the interrupt to take effect (give it 2 seconds max)
      await wait.for({ seconds: 2 });

      // Try to acquire lock again
      const retryLock = await acquireResponseLock(
        payload.conversationId,
        taskId,
        sender,
        isGroup,
      );
      if (!retryLock) {
        log.info("Could not acquire lock, giving up");
        return {
          skipped: true,
          reason: "lock_acquisition_failed",
        };
      }
    }

    // Lock acquired, safe to respond
    log.info("Responding after debounce");

    // Get conversation history and context (last 100 messages)
    const { messages, context } = await getConversationMessages(
      payload.conversationId,
      100,
    );

    if (messages.length === 0) {
      log.info("No messages found");
      return {
        skipped: true,
        reason: "no_messages",
      };
    }

    // Override sender from task context to ensure correct tool authentication in group chats
    // This is critical for security: we must use the sender who triggered this task,
    // not the most recent message sender (which may be a different participant)
    if (isGroup && sender) {
      context.sender = sender;
    }

    // Log conversation type and context with sender info
    log.info("Processing conversation", {
      type: context.isGroup ? "GROUP_CHAT" : "DIRECT_MESSAGE",
      sender: context.sender || "NOT_FOUND",
      messageCount: messages.length,
    });
    if (context.isGroup && !context.sender) {
      log.error("Group chat but no sender in context - tool auth will fail");
    }
    if (context.summary) {
      log.debug("Conversation has summary", { summary: context.summary });
    }

    // Generate AI response with full conversation context
    try {
      // Create callback to send quick notification when tools are invoked
      const onToolsInvoked = async (toolNames: string[]) => {
        const loadingMessage = getLoadingMessage(toolNames);
        log.info("Sending tool notification", {
          message: loadingMessage,
          tools: toolNames,
        });
        try {
          const baseParams = payload.group
            ? { group: payload.group }
            : { recipient: payload.recipient! };

          await loopClient.sendLoopMessage({
            ...baseParams,
            text: loadingMessage,
          });
          log.info("Tool notification sent");
        } catch (err) {
          log.error("Failed to send tool notification", { error: err });
        }
      };

      const actions = await respondToMessage(
        mrWhiskersAgent,
        messages,
        context,
        { onToolsInvoked },
      );

      // If no actions, we're done (e.g., group chat where no response is needed)
      if (actions.length === 0) {
        log.info("No actions to execute (likely group chat silence)");
        await releaseResponseLock(
          payload.conversationId,
          taskId,
          sender,
          isGroup,
        );
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
        sender,
        isGroup,
      });

      return {
        success: true,
        actionsExecuted: actions.length,
      };
    } catch (error) {
      // Release lock on error
      await releaseResponseLock(
        payload.conversationId,
        taskId,
        sender,
        isGroup,
      );
      throw error;
    }
  },
});
