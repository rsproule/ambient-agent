import type { Agent } from "@/src/ai/agents/types";
import type { ConversationContext } from "@/src/db/conversation";
import type {
  IMessageResponse,
  MessageAction,
} from "@/src/lib/loopmessage-sdk/actions";
import { Output, ToolLoopAgent, type ModelMessage } from "ai";

// Re-export MessageAction type for convenience
export type { MessageAction } from "@/src/lib/loopmessage-sdk/actions";

/**
 * Generate a response using the provided agent and conversation context.
 *
 * AI SDK v6 Pattern: Use ToolLoopAgent which handles both tool calling
 * and structured output generation automatically.
 *
 * @param agent - The agent to use for generating the response
 * @param messages - The conversation message history (ModelMessage[] from getConversationMessages)
 * @param context - The conversation context (group vs DM, summary, etc.)
 * @returns Array of MessageActions (messages or reactions) to execute
 */
export async function respondToMessage(
  agent: Agent,
  messages: ModelMessage[],
  context: ConversationContext,
): Promise<MessageAction[]> {
  const before = performance.now();

  // Build conversation context string using agent's context builder
  const contextString = agent.buildContext(context);

  console.log(
    `[${agent.name}] Generating response for ${
      context.isGroup ? "GROUP CHAT" : "DIRECT MESSAGE"
    }${agent.tools ? ` (with ${Object.keys(agent.tools).length} tools)` : ""}`,
  );

  // Combine context with agent's base instructions
  const systemPrompt = `${contextString}\n\n${agent.baseInstructions}`;

  // Create ToolLoopAgent with structured output support
  const loopAgent = new ToolLoopAgent({
    model: agent.model,
    ...(agent.tools && Object.keys(agent.tools).length > 0
      ? { tools: agent.tools }
      : {}),
    instructions: systemPrompt,
    output: Output.object({
      schema: agent.schema,
    }),
  });

  console.log(
    `[${agent.name}] Calling ToolLoopAgent.generate() with ${messages.length} messages...`,
  );
  console.log(
    `[${agent.name}] Agent config:`,
    JSON.stringify({
      hasTools: !!agent.tools && Object.keys(agent.tools).length > 0,
      toolNames: agent.tools ? Object.keys(agent.tools) : [],
      hasSchema: !!agent.schema,
    }),
  );

  try {
    // Generate response - the agent handles tool calling and structured output automatically
    // Use messages parameter (accepts ModelMessage[])
    const { output } = await loopAgent.generate({
      messages,
    });

    const after = performance.now();
    console.log(`[${agent.name}] Time taken: ${Math.round(after - before)}ms`);

    return (output as IMessageResponse).actions;
  } catch (error) {
    const after = performance.now();
    console.error(
      `[${agent.name}] Error after ${Math.round(after - before)}ms:`,
      error,
    );
    throw error;
  }
}
