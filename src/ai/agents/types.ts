import type { ConversationContext } from "@/src/db/conversation";
import type { LanguageModel } from "ai";
import type { z } from "zod";

/**
 * An agent is a composable personality/behavior configuration
 * that can be used to generate responses with iMessage actions.
 *
 * Agents encapsulate:
 * - Personality and behavior (baseInstructions)
 * - Context building logic (buildContext)
 * - Model configuration (model)
 * - Output schema (schema)
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
   * Base system instructions that define the agent's personality,
   * behavior rules, and response guidelines
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
}
