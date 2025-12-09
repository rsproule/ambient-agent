/**
 * AI Agent Message Action Types
 *
 * These types define the structured output format for our AI agents.
 * Uses our internal constants for validation to ensure API compatibility.
 */

import { z } from "zod";
import { MESSAGE_EFFECTS, MESSAGE_REACTIONS } from "./constants";

/**
 * Message Action Schema - AI agent actions that map to LoopMessage API calls
 *
 * Note: Using a single object with optional fields instead of discriminatedUnion
 * because Anthropic doesn't support oneOf in structured output schemas.
 */
export const MessageActionSchema = z.object({
  type: z.enum(["message", "reaction"]).describe("Action type"),
  // Message fields (required when type is 'message')
  text: z.string().optional().describe("The message text to send"),
  attachments: z
    .array(z.string())
    .optional()
    .describe("Array of image URLs to attach"),
  effect: z.enum(MESSAGE_EFFECTS).optional().describe("iMessage effect"),
  subject: z
    .string()
    .optional()
    .describe("Message subject (appears as bold title)"),
  reply_to_id: z.string().optional().describe("Message ID to reply to"),
  // Reaction fields (required when type is 'reaction')
  message_id: z
    .string()
    .optional()
    .describe("The message ID to react to (required for reactions)"),
  reaction: z
    .enum(MESSAGE_REACTIONS)
    .optional()
    .describe(
      "Reaction type (required for reactions, prefix with - to remove)",
    ),
  // Shared fields
  delay: z
    .number()
    .optional()
    .describe("Delay in milliseconds before sending this action"),
});

export const IMessageResponseSchema = z.object({
  actions: z
    .array(MessageActionSchema)
    .min(0)
    .describe(
      "Array of actions to perform in sequence. Can be empty if no response is needed.",
    ),
  noResponseReason: z
    .string()
    .optional()
    .describe(
      "If actions is empty, briefly explain why (e.g., 'not addressed', 'reaction only needed', 'safety concern')",
    ),
});

export type MessageAction = z.infer<typeof MessageActionSchema>;
export type IMessageResponse = z.infer<typeof IMessageResponseSchema>;

// Re-export our types for convenience
export type { MessageEffect, MessageReaction } from "./constants";
