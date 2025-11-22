import { z } from "zod";

/**
 * LoopMessage Webhook Schemas
 * Based on actual API behavior, validated at runtime with Zod
 */

// Common fields across all webhook types
const baseWebhookSchema = z.object({
  alert_type: z.string(),
  timestamp: z.string().optional(),
  passthrough: z.string().optional(),
});

// Message inbound webhook
export const messageInboundSchema = baseWebhookSchema.extend({
  alert_type: z.literal("message_inbound"),
  recipient: z.string(), // This is actually the sender's phone
  text: z.string(),
  group_id: z.string().optional(),
  message_type: z.string().optional(),
  speech: z
    .object({
      text: z.string().optional(),
    })
    .optional(),
  attachments: z.array(z.string()).optional(),
  reply_to_id: z.string().optional(),
});

// Message sent webhook
export const messageSentSchema = baseWebhookSchema.extend({
  alert_type: z.literal("message_sent"),
  message_id: z.string(),
  recipient: z.string().optional(),
  group_id: z.string().optional(),
  text: z.string().optional(),
});

// Message failed webhook
export const messageFailedSchema = baseWebhookSchema.extend({
  alert_type: z.literal("message_failed"),
  message_id: z.string(),
  recipient: z.string().optional(),
  group_id: z.string().optional(),
  text: z.string().optional(),
  error_code: z.number().optional(),
  error_message: z.string().optional(),
});

// Message reaction webhook
export const messageReactionSchema = baseWebhookSchema.extend({
  alert_type: z.literal("message_reaction"),
  message_id: z.string(),
  recipient: z.string(),
  reaction: z.string(),
  from: z.string().optional(),
});

// Message typing webhook
export const messageTypingSchema = baseWebhookSchema.extend({
  alert_type: z.literal("message_typing"),
  from: z.string(),
  recipient: z.string().optional(),
});

// Message read webhook
export const messageReadSchema = baseWebhookSchema.extend({
  alert_type: z.literal("message_read"),
  message_id: z.string(),
  from: z.string(),
  recipient: z.string().optional(),
});

// Auth response webhook
export const authResponseSchema = baseWebhookSchema.extend({
  alert_type: z.literal("auth_response"),
  request_id: z.string(),
  recipient: z.string().optional(),
});

// Group created webhook
export const groupCreatedSchema = baseWebhookSchema.extend({
  alert_type: z.literal("group_created"),
  group_id: z.string(),
  group_name: z.string().optional(),
  participants: z.array(z.string()),
  creator: z.string().optional(),
});

// Union of all webhook types
export const loopWebhookSchema = z.discriminatedUnion("alert_type", [
  messageInboundSchema,
  messageSentSchema,
  messageFailedSchema,
  messageReactionSchema,
  messageTypingSchema,
  messageReadSchema,
  authResponseSchema,
  groupCreatedSchema,
]);

// Infer TypeScript types from Zod schemas
export type LoopWebhook = z.infer<typeof loopWebhookSchema>;
export type MessageInboundWebhook = z.infer<typeof messageInboundSchema>;
export type MessageSentWebhook = z.infer<typeof messageSentSchema>;
export type MessageFailedWebhook = z.infer<typeof messageFailedSchema>;
export type MessageReactionWebhook = z.infer<typeof messageReactionSchema>;
export type MessageTypingWebhook = z.infer<typeof messageTypingSchema>;
export type MessageReadWebhook = z.infer<typeof messageReadSchema>;
export type AuthResponseWebhook = z.infer<typeof authResponseSchema>;
export type GroupCreatedWebhook = z.infer<typeof groupCreatedSchema>;


