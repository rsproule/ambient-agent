import type { Agent } from "@/src/ai/agents/types";
import { getAppForContext } from "@/src/ai/apps";
import {
  createCalendarTools,
  createCompleteOnboardingTool,
  createGenerateConnectionLinkTool,
  createGetUserContextTool,
  createGitHubTools,
  createGmailTools,
  createGroupChatSettingsTools,
  createRequestFeatureTool,
  createRequestResearchTool,
  createScheduledJobTools,
  createSwitchAppTool,
  createUpdateUserContextTool,
} from "@/src/ai/tools";
import { hasActiveConnections } from "@/src/ai/tools/helpers";
import type { ConversationContext } from "@/src/db/conversation";
import { logToolCall } from "@/src/db/events";
import logger from "@/src/lib/logger";
import type {
  IMessageResponse,
  MessageAction,
} from "@/src/lib/loopmessage-sdk/message-actions";
import { Output, ToolLoopAgent, type ModelMessage } from "ai";

// Re-export MessageAction type for convenience
export type { MessageAction } from "@/src/lib/loopmessage-sdk/message-actions";

/**
 * Options for respondToMessage
 */
export interface RespondToMessageOptions {
  /**
   * Optional callback fired once when the first tool call is about to execute.
   * Use this to send a "working on it" notification to the user.
   */
  onToolsInvoked?: (toolNames: string[]) => Promise<void>;
  /**
   * AbortController for cancelling generation when superseded by a newer task.
   */
  abortController?: AbortController;
  /**
   * Polling callback to check if this generation should abort.
   * Called every 300ms during generation.
   */
  checkShouldAbort?: () => Promise<boolean>;
}

/**
 * Generate a response using the provided agent and conversation context.
 *
 * AI SDK v6 Pattern: Use ToolLoopAgent which handles both tool calling
 * and structured output generation automatically.
 *
 * @param agent - The agent to use for generating the response
 * @param messages - The conversation message history (ModelMessage[] from getConversationMessages)
 * @param context - The conversation context (group vs DM, summary, etc.)
 * @param options - Optional callbacks and configuration
 * @returns Array of MessageActions (messages or reactions) to execute
 */
export async function respondToMessage(
  defaultAgent: Agent,
  messages: ModelMessage[],
  context: ConversationContext,
  options?: RespondToMessageOptions,
): Promise<MessageAction[]> {
  const before = performance.now();

  // Get active app (foreground app for this conversation)
  const activeApp = getAppForContext(context);

  // Use app's agent if defined, otherwise use the default agent
  const agent = activeApp?.agent ?? defaultAgent;

  // Build conversation context string using agent's context builder
  const contextString = agent.buildContext(context);

  // Check if user has any connections before creating integration tools
  // This reduces memory usage when no OAuth connections exist
  const userHasConnections = await hasActiveConnections(context);

  // Create context-bound tools (identity from system context, cannot be spoofed)
  // These tools get user identity from context.sender (for groups) or context.conversationId (for DMs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contextBoundTools: Record<string, any> = {
    getUserContext: createGetUserContextTool(context),
    updateUserContext: createUpdateUserContextTool(context),
    requestResearch: createRequestResearchTool(context),
    requestFeature: createRequestFeatureTool(context),
    completeOnboarding: createCompleteOnboardingTool(context),
    switchApp: createSwitchAppTool(context),
    ...createScheduledJobTools(context),
  };

  // Add DM-only tools (connection link not available in groups to prevent spam)
  if (!context.isGroup) {
    contextBoundTools.generateConnectionLink =
      createGenerateConnectionLinkTool(context);
  }

  // Add group chat-only tools (settings management)
  if (context.isGroup) {
    const groupTools = createGroupChatSettingsTools(context);
    Object.assign(contextBoundTools, groupTools);
  }

  // Conditionally merge integration tools only if user has connections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const integrationTools: Record<string, any> = userHasConnections
    ? {
        ...createGmailTools(context),
        ...createGitHubTools(context),
        ...createCalendarTools(context),
      }
    : {};

  // Combine all available tools
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allTools: Record<string, any> = {
    ...(agent.tools || {}),
    ...contextBoundTools,
    ...integrationTools,
  };

  // If an app is active, filter tools to only those allowed
  if (activeApp?.allowedTools) {
    const allowedSet = new Set(activeApp.allowedTools);
    allTools = Object.fromEntries(
      Object.entries(allTools).filter(([name]) => allowedSet.has(name)),
    );
  }

  // Add app-specific additional tools
  if (activeApp?.additionalTools) {
    allTools = { ...allTools, ...activeApp.additionalTools };
  }

  const totalToolCount = Object.keys(allTools).length;
  const log = logger.child({
    component: agent.name,
    conversationId: context.conversationId,
    isGroup: context.isGroup,
    sender: context.sender,
    app: activeApp?.id || "default",
  });

  log.info("Generating response", {
    type: context.isGroup ? "GROUP_CHAT" : "DIRECT_MESSAGE",
    toolCount: totalToolCount,
    app: activeApp?.id || "default",
  });

  if (context.isGroup && !context.sender) {
    log.error("Group chat but context.sender is not set - tool auth will fail");
  }
  if (context.sender) {
    log.debug("Tools authenticated", { authenticatedAs: context.sender });
  }
  if (userHasConnections) {
    log.debug("User has active OAuth connections - integration tools enabled");
  }
  if (activeApp) {
    log.debug("App active", {
      appId: activeApp.id,
      appName: activeApp.name,
      allowedTools: activeApp.allowedTools,
    });
  }

  log.debug("Tool list", { tools: Object.keys(allTools) });

  // Validate each tool schema in detail
  Object.entries(allTools).forEach(([name, tool]) => {
    const toolObj = tool as { inputSchema?: unknown };
    if (!toolObj.inputSchema) {
      log.error("Tool missing inputSchema", { toolName: name });
    }
  });

  // Build app context injection if an app is active
  let appContextInjection = "";
  if (activeApp) {
    const separator = "═".repeat(50);
    appContextInjection = `\n\n${separator}\nAPP: ${activeApp.name}\n\n${activeApp.systemPrompt}\n${separator}`;

    // Add custom app context if defined
    if (activeApp.buildAppContext) {
      appContextInjection += `\n\n${activeApp.buildAppContext(context)}`;
    }
  }

  // Combine context with agent's base instructions and app prompt
  const systemPrompt = `${contextString}${appContextInjection}\n\n${agent.baseInstructions}`;

  // Track if we've already notified about tool use (only fire once)
  let hasNotifiedToolUse = false;

  // Create ToolLoopAgent with structured output support
  const loopAgent = new ToolLoopAgent({
    model: agent.model,
    ...(Object.keys(allTools).length > 0 ? { tools: allTools } : {}),
    instructions: systemPrompt,
    output: Output.object({
      schema: agent.schema,
    }),
    // Fire callback on first tool call to notify user we're working
    onStepFinish: async ({ toolCalls }) => {
      if (
        toolCalls &&
        toolCalls.length > 0 &&
        !hasNotifiedToolUse &&
        options?.onToolsInvoked
      ) {
        hasNotifiedToolUse = true;
        const toolNames = toolCalls.map((tc) => tc.toolName);
        log.info("Tool call detected, firing onToolsInvoked", {
          tools: toolNames,
        });
        try {
          await options.onToolsInvoked(toolNames);
        } catch (err) {
          log.error("Error in onToolsInvoked callback", { error: err });
        }
      }
    },
  });

  // Prepend recent images so Claude can visually "see" them
  // This allows Claude to understand image content when user says "make it brighter" etc.
  let messagesWithImageContext = messages;

  log.debug("Recent attachments", {
    count: context.recentAttachments?.length ?? 0,
  });

  if (context.recentAttachments && context.recentAttachments.length > 0) {
    // Include up to 3 most recent images for context (to limit token usage)
    const imagesToShow = context.recentAttachments.slice(0, 3);
    // Build content with labeled images and their URLs
    const imageContent: Array<
      { type: "text"; text: string } | { type: "image"; image: URL }
    > = [
      {
        type: "text",
        text: `[CONTEXT: Recent images in this conversation. When user asks to edit/modify an image, use createImage with the image's URL:]`,
      },
    ];

    imagesToShow.forEach((url, i) => {
      imageContent.push({ type: "text", text: `[Image ${i} URL: ${url}]` });
      imageContent.push({ type: "image", image: new URL(url) });
    });

    const imageContextMessage: ModelMessage = {
      role: "user",
      content: imageContent,
    };

    // Insert image context at the beginning, followed by an assistant acknowledgment
    messagesWithImageContext = [
      imageContextMessage,
      {
        role: "assistant",
        content:
          "[Acknowledged - I can see these images. If asked to edit one, I'll use createImage with the image's URL.]",
      } as ModelMessage,
      ...messages,
    ];

    log.debug("Added images to context for visual awareness", {
      imageCount: imagesToShow.length,
    });
  }

  log.debug("Calling ToolLoopAgent.generate()", {
    messageCount: messagesWithImageContext.length,
  });

  // Start polling interval if checkShouldAbort is provided
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  if (options?.checkShouldAbort && options?.abortController) {
    pollInterval = setInterval(async () => {
      try {
        const shouldAbort = await options.checkShouldAbort!();
        if (shouldAbort) {
          log.info("Generation superseded, aborting");
          options.abortController!.abort();
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch (err) {
        log.error("Error in checkShouldAbort", { error: err });
      }
    }, 300);
  }

  try {
    const result = await loopAgent.generate({
      messages: messagesWithImageContext,
      abortSignal: options?.abortController?.signal,
    });

    const after = performance.now();
    log.info("Response generated", { timeMs: Math.round(after - before) });

    if (result.steps && result.steps.length > 0) {
      for (const step of result.steps) {
        // Log tool calls with their results
        if (step.toolCalls && step.toolResults) {
          for (let i = 0; i < step.toolCalls.length; i++) {
            const toolCall = step.toolCalls[i];
            const toolResult = step.toolResults[i];

            const output = toolResult?.output as
              | { success?: boolean; message?: string }
              | undefined;

            const success = !(
              output &&
              typeof output === "object" &&
              output.success === false
            );

            if (!success) {
              log.error("Tool failed", {
                tool: toolCall.toolName,
                error: output?.message || "Unknown error",
              });
            } else {
              log.debug("Tool result", {
                tool: toolCall.toolName,
              });
            }

            // Log tool call event
            await logToolCall(context.conversationId, {
              toolName: toolCall.toolName,
              input: toolCall.input,
              output: toolResult?.output,
              success,
              error: !success ? output?.message : undefined,
            });
          }
        }
      }
    }

    const output = result.output as IMessageResponse;
    const actions = output.actions;

    if (actions.length === 0) {
      log.info("AI returned 0 actions", {
        isGroup: context.isGroup,
        sender: context.sender,
        stepCount: result.steps?.length ?? 0,
        reason: output.noResponseReason ?? "none provided",
      });
    } else {
      log.info("Generated actions", { actionCount: actions.length });
    }

    return actions;
  } catch (error) {
    const after = performance.now();
    if (options?.abortController?.signal.aborted) {
      log.info("Generation aborted", { timeMs: Math.round(after - before) });
      return [];
    }
    log.error("Error generating response", {
      timeMs: Math.round(after - before),
      error,
    });
    throw error;
  } finally {
    if (pollInterval) clearInterval(pollInterval);
  }
}
