import { mrWhiskersAgent } from "@/src/ai/agents/mrWhiskers";
import { respondToMessage } from "@/src/ai/respondToMessage";
import {
  acquireResponseLock,
  getConversationMessages,
  isCurrentGeneration,
  releaseResponseLock,
  saveAssistantMessage,
} from "@/src/db/conversation";
import { createContextLogger } from "@/src/lib/logger";
import { LoopMessageClient } from "@/src/lib/loopmessage-sdk/client";
import { task, wait } from "@trigger.dev/sdk/v3";
import { logTaskCompleted, logTaskFailed, logTaskStarted } from "../taskEvents";
import { handleMessageResponse } from "./handleMessage";

// Create LoopMessage client for sending quick notifications
const loopClient = new LoopMessageClient({
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

  // Claude task execution
  claude_task: ["starting that up...", "spinning up claude...", "on it..."],
};

/**
 * Get a random loading message for the given tools
 * Returns null if no specific message is defined (no loading message will be sent)
 */
function getLoadingMessage(toolNames: string[]): string | null {
  // Try to find a specific message for the first tool
  for (const toolName of toolNames) {
    const messages = TOOL_LOADING_MESSAGES[toolName];
    if (messages && messages.length > 0) {
      return messages[Math.floor(Math.random() * messages.length)];
    }
  }
  // No message defined for these tools - don't send a loading message
  return null;
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
    const taskId = ctx.run.id;
    const isGroup = !!payload.group;
    const sender = isGroup ? payload.recipient : undefined;
    const startTime = performance.now();

    const taskCtx = {
      taskId,
      taskName: "debounced-response",
      conversationId: payload.conversationId,
      userId: sender,
    };

    const log = createContextLogger({
      component: "debouncedResponse",
      conversationId: payload.conversationId,
      groupId: payload.group,
      sender,
    });

    // Log task started
    await logTaskStarted(taskCtx, {
      isGroup,
      isNewUser: payload.isNewUser,
    });

    // Wait 1 second (debounce period) to batch rapid messages
    await wait.for({ seconds: 1 });

    // Acquire lock (always succeeds, overwrites previous - old task will abort via polling)
    await acquireResponseLock(payload.conversationId, taskId, sender, isGroup);
    log.info("Lock acquired, starting generation");

    // Get conversation history and context (last 100 messages)
    const { messages, context } = await getConversationMessages(
      payload.conversationId,
      100,
    );

    if (messages.length === 0) {
      log.info("No messages found");
      const result = { skipped: true, reason: "no_messages" };
      await logTaskCompleted(taskCtx, result, performance.now() - startTime);
      return result;
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

    // Create AbortController for cancellation when superseded
    const abortController = new AbortController();
    const checkShouldAbort = async () => {
      const isCurrent = await isCurrentGeneration(
        payload.conversationId,
        taskId,
        sender,
        isGroup,
      );
      return !isCurrent;
    };

    try {
      const onToolsInvoked = async (toolNames: string[]) => {
        const loadingMessage = getLoadingMessage(toolNames);

        // If no loading message is defined for these tools, skip sending
        if (!loadingMessage) {
          log.debug("No loading message defined for tools", {
            tools: toolNames,
          });
          return;
        }

        log.info("Sending tool notification", {
          message: loadingMessage,
          tools: toolNames,
        });
        try {
          const baseParams = payload.group
            ? { group: payload.group }
            : { recipient: payload.recipient! };

          const response = await loopClient.sendLoopMessage({
            ...baseParams,
            text: loadingMessage,
          });

          // Save the tool notification message to the database
          await saveAssistantMessage(
            payload.conversationId,
            loadingMessage,
            response.message_id,
          );
        } catch (err) {
          log.error("Failed to send tool notification", { error: err });
        }
      };

      const actions = await respondToMessage(
        mrWhiskersAgent,
        messages,
        context,
        { onToolsInvoked, abortController, checkShouldAbort },
      );

      // Check if we were aborted (superseded by newer task)
      if (abortController.signal.aborted) {
        log.info("Generation aborted (superseded)");
        const result = { skipped: true, reason: "superseded" };
        await logTaskCompleted(taskCtx, result, performance.now() - startTime);
        return result;
      }

      if (actions.length === 0) {
        const lastMsg = messages[messages.length - 1];
        const lastMsgPreview =
          typeof lastMsg?.content === "string"
            ? lastMsg.content.slice(0, 100)
            : JSON.stringify(lastMsg?.content)?.slice(0, 100);
        log.warn("AI decided not to respond", {
          isGroup,
          sender: context.sender,
          messageCount: messages.length,
          lastMessage: lastMsgPreview,
        });
        await releaseResponseLock(
          payload.conversationId,
          taskId,
          sender,
          isGroup,
        );
        const result = {
          success: true,
          actionsExecuted: 0,
          noResponseNeeded: true,
        };
        await logTaskCompleted(taskCtx, result, performance.now() - startTime);
        return result;
      }

      await handleMessageResponse.triggerAndWait({
        conversationId: payload.conversationId,
        recipient: payload.recipient,
        group: payload.group,
        actions,
        taskId,
        sender,
        isGroup,
      });

      const result = { success: true, actionsExecuted: actions.length };
      await logTaskCompleted(taskCtx, result, performance.now() - startTime);
      return result;
    } catch (error) {
      await releaseResponseLock(
        payload.conversationId,
        taskId,
        sender,
        isGroup,
      );
      await logTaskFailed(
        taskCtx,
        error instanceof Error ? error : String(error),
        performance.now() - startTime,
      );
      throw error;
    }
  },
});
