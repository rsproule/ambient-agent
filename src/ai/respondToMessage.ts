import type { Agent } from "@/src/ai/agents/types";
import type { ConversationContext } from "@/src/db/conversation";
import type {
  IMessageResponse,
  MessageAction,
} from "@/src/lib/loopmessage-sdk/actions";
import type { CoreMessage } from "ai";
import { generateObject } from "ai";

// Re-export MessageAction type for convenience
export type { MessageAction } from "@/src/lib/loopmessage-sdk/actions";

/**
 * Generate a response using the provided agent and conversation context.
 *
 * This function:
 * 1. Builds contextual information using the agent's buildContext function
 * 2. Combines context with agent's base instructions as the system prompt
 * 3. Uses generateObject to create structured iMessage actions
 *
 * @param agent - The agent to use for generating the response
 * @param messages - The conversation message history
 * @param context - The conversation context (group vs DM, summary, etc.)
 * @returns Array of MessageActions (messages or reactions) to execute
 */
export async function respondToMessage(
  agent: Agent,
  messages: CoreMessage[],
  context: ConversationContext,
): Promise<MessageAction[]> {
  const before = performance.now();

  // Build conversation context string using agent's context builder
  const contextString = agent.buildContext(context);

  console.log(
    `[${agent.name}] Generating response for ${
      context.isGroup ? "GROUP CHAT" : "DIRECT MESSAGE"
    }`,
  );

  // Combine context with agent's base instructions
  const systemPrompt = `${contextString}\n\n${agent.baseInstructions}`;

  // Generate structured response using the agent's configuration
  const { object } = await generateObject({
    model: agent.model,
    schema: agent.schema,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages,
    ],
  });

  const after = performance.now();
  console.log(
    `[${agent.name}] Time taken to generate actions: ${after - before}ms`,
  );

  return (object as IMessageResponse).actions;
}
