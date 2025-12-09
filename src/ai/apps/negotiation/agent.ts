import type { Agent } from "@/src/ai/agents/types";
import { IMessageResponseSchema } from "@/src/lib/loopmessage-sdk/message-actions";
import { createAnthropic } from "@ai-sdk/anthropic";
import { IMESSAGE_SYSTEM_PROMPT } from "../../agents/systemPrompt";
import { grokSearchTool } from "../../tools/search";
import { NEGOTIATION_PROMPT } from "./prompt";

const anthropic = createAnthropic({});

/**
 * The Negotiation Agent definition.
 * Used by the onboarding negotiation app to interact with new users,
 * research their background, and negotiate a signup bonus.
 *
 * Note: Context-bound tools (generateConnectionLink, etc.) are added
 * dynamically in respondToMessage based on conversation context.
 * Only static tools should be defined here.
 */
export const negotiationAgent: Agent = {
  id: "negotiation-agent",
  name: "Onboarding Negotiator",
  baseInstructions: IMESSAGE_SYSTEM_PROMPT,
  buildContext: (context) => context.toString(),
  schema: IMessageResponseSchema,
  personality: {
    id: "negotiation-agent",
    name: "Onboarding Negotiator",
    description:
      "An AI agent specializing in onboarding new users and negotiating their signup bonus, leveraging user research and engaging conversational skills.",
    prompt: NEGOTIATION_PROMPT,
  },
  model: anthropic("claude-sonnet-4-5"),
  tools: {
    search: grokSearchTool,
  },
};
