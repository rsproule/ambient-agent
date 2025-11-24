import type { ConversationContext } from "@/src/db/conversation";
import type { LanguageModel } from "ai";
import type { z } from "zod";
import type { AgentPersonality } from "./personalities";

/**
 * An agent is a complete configuration for generating iMessage responses.
 *
 * Agents compose together:
 * - Personality (voice, style, character)
 * - System prompt (technical iMessage interaction rules)
 * - Context building logic
 * - Model configuration
 * - Output schema
 * - Optional tools for extended functionality
 */
export interface Agent<TSchema extends z.ZodType = z.ZodType> {
  /**
   * Unique identifier for the agent
   */
  id: string;

  /**
   * Display name
   */
  name: string;

  /**
   * The personality configuration (voice, style, character)
   */
  personality: AgentPersonality;

  /**
   * Full system instructions (personality + technical prompts)
   * This is typically built by composing personality.prompt with system prompts
   */
  baseInstructions: string;

  /**
   * Build contextual information from the conversation
   * This allows agents to customize how they interpret context
   */
  buildContext: (context: ConversationContext) => string;

  /**
   * The language model to use for generation
   */
  model: LanguageModel;

  /**
   * The output schema that defines the structure of responses
   */
  schema: TSchema;

  /**
   * Optional tools that the agent can use
   * Tools allow agents to perform actions like updating configs, querying data, etc.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Record<string, any>;
}
