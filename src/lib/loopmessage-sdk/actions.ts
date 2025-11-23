import { z } from "zod";

/**
 * iMessage Action Schema
 * 
 * Defines the structured output format for interacting with iMessage.
 * This schema is platform-specific (iMessage) and can be used by any agent
 * that needs to generate iMessage actions.
 */

export const MessageActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    text: z.string().describe("The message text to send"),
    delay: z
      .number()
      .optional()
      .describe(
        "Delay in milliseconds before sending this message (for realistic pauses)",
      ),
    attachments: z
      .array(z.string())
      .optional()
      .describe("Array of image URLs to attach"),
    effect: z
      .enum([
        "slam",
        "loud",
        "gentle",
        "invisibleInk",
        "echo",
        "spotlight",
        "balloons",
        "confetti",
        "love",
        "lasers",
        "fireworks",
        "shootingStar",
        "celebration",
      ])
      .optional()
      .describe("iMessage effect"),
    subject: z
      .string()
      .optional()
      .describe("Message subject (appears as bold title)"),
    reply_to_id: z.string().optional().describe("Message ID to reply to"),
  }),
  z.object({
    type: z.literal("reaction"),
    message_id: z.string().describe("The message ID to react to"),
    reaction: z
      .enum([
        "love",
        "like",
        "dislike",
        "laugh",
        "exclaim",
        "question",
        "-love",
        "-like",
        "-dislike",
        "-laugh",
        "-exclaim",
        "-question",
      ])
      .describe("Reaction type (prefix with - to remove)"),
    delay: z
      .number()
      .optional()
      .describe("Delay in milliseconds before sending this reaction"),
  }),
]);

export const IMessageResponseSchema = z.object({
  actions: z
    .array(MessageActionSchema)
    .min(0)
    .describe(
      "Array of actions to perform in sequence. Can be empty if no response is needed.",
    ),
});

export type MessageAction = z.infer<typeof MessageActionSchema>;
export type IMessageResponse = z.infer<typeof IMessageResponseSchema>;

