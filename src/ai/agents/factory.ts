import type { ConversationContext } from "@/src/db/conversation";
import type { LanguageModel } from "ai";
import type { z } from "zod";
import type { AgentPersonality } from "./personalities";
import {
  IMESSAGE_SYSTEM_PROMPT,
  buildConversationContextPrompt,
} from "./systemPrompt";
import type { Agent } from "./types";

export function defaultBuildContext(context: ConversationContext): string {
  return buildConversationContextPrompt({
    conversationId: context.conversationId,
    isGroup: context.isGroup,
    summary: context.summary,
  });
}

export function buildFullInstructions(
  personality: string,
  systemPrompt: string = IMESSAGE_SYSTEM_PROMPT,
): string {
  return `${personality}\n\n${systemPrompt}`;
}

export function createAgent<TSchema extends z.ZodType = z.ZodType>(options: {
  personality: AgentPersonality;
  model: LanguageModel;
  schema: TSchema;
  buildContext?: (context: ConversationContext) => string;
  systemPrompt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Record<string, any>;
}): Agent<TSchema> {
  const {
    personality,
    model,
    schema,
    buildContext = defaultBuildContext,
    systemPrompt = IMESSAGE_SYSTEM_PROMPT,
    tools,
  } = options;

  return {
    id: personality.id,
    name: personality.name,
    personality,
    baseInstructions: buildFullInstructions(personality.prompt, systemPrompt),
    buildContext,
    model,
    schema,
    tools,
  };
}
