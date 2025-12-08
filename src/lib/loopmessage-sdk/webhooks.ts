/**
 * LoopMessage Webhook Schemas - Exact match to API documentation
 * Based on: https://docs.loopmessage.com/webhooks
 */

import { z } from "zod";

/**
 * Alert types from LoopMessage webhooks - exact API match
 */
export const AlertTypeSchema = z.enum([
  "message_scheduled",
  "conversation_inited",
  "message_failed",
  "message_sent",
  "message_inbound",
  "message_reaction",
  "message_timeout",
  "group_created",
  "inbound_call",
  "unknown",
]);

/**
 * Message types for inbound messages - exact API match
 */
export const MessageTypeSchema = z.enum([
  "text",
  "reaction",
  "audio",
  "attachments",
  "sticker",
  "location",
]);

/**
 * Delivery types - exact API match
 */
export const DeliveryTypeSchema = z.enum(["imessage", "sms"]);

/**
 * Reaction types - exact API match
 * Note: API docs show base reactions, but we support remove variants (-prefix)
 */
export const ReactionTypeSchema = z.enum([
  "love",
  "like",
  "dislike",
  "laugh",
  "exclaim",
  "question",
  "unknown",
]);

/**
 * Language object - exact API match
 */
export const LanguageSchema = z.object({
  /** ISO 639-1 code (e.g., 'en', 'fr', 'de', 'ja', 'zh') */
  code: z.string(),
  /** Language name (e.g., 'English', 'French', 'German') */
  name: z.string(),
  /** Optional script for Chinese: 'Hans' (Simplified) or 'Hant' (Traditional) */
  script: z.enum(["Hans", "Hant"]).optional(),
});

/**
 * Speech metadata - exact API match
 */
export const SpeechMetadataSchema = z.object({
  /** Words spoken per minute */
  speaking_rate: z.number().optional(),
  /** Average pause between words in seconds */
  average_pause_duration: z.number().optional(),
  /** Timestamp of start of speech in audio */
  speech_start_timestamp: z.number().optional(),
  /** Duration of speech in audio */
  speech_duration: z.number().optional(),
  /** Vocal stability as percentage */
  jitter: z.number().optional(),
  /** Vocal stability in decibels */
  shimmer: z.number().optional(),
  /** Highness/lowness of tone in logarithm of normalized pitch estimates */
  pitch: z.number().optional(),
  /** Probability of whether a frame is voiced or not */
  voicing: z.number().optional(),
});

/**
 * Speech transcription - exact API match
 */
export const SpeechSchema = z.object({
  /** Text transcription from audio message */
  text: z.string(),
  /** Language of the speech */
  language: LanguageSchema,
  /** Optional metadata about the speech */
  metadata: SpeechMetadataSchema.optional(),
});

/**
 * Group information - exact API match
 */
export const GroupSchema = z.object({
  /** Unique ID of iMessage group */
  group_id: z.string(),
  /** Optional custom name for the group */
  name: z.string().optional(),
  /** Array of participants (phone numbers in E164 format or emails in lowercase) */
  participants: z.array(z.string()),
});

/**
 * Base webhook payload schema - contains all possible fields from API docs
 */
const BaseWebhookSchema = z.object({
  /** Unique identifier of your request/message */
  message_id: z.string(),
  /** Unique identifier of the event */
  webhook_id: z.string(),
  /** Type of alert */
  alert_type: AlertTypeSchema,
  /** API version */
  api_version: z.string().optional(),
  /** Contact the message is related to (E164 phone or lowercase email) */
  recipient: z.string().optional(),
  /** Message text */
  text: z.string().optional(),
  /** Optional message subject */
  subject: z.string().optional(),
  /** Dedicated sender name */
  sender_name: z.string().optional(),
  /** Custom passthrough data */
  passthrough: z.string().optional(),
  /** Indicates if related to sandbox contacts */
  sandbox: z.boolean().optional(),
  /** The dominant language used in the text */
  language: LanguageSchema.optional(),
});

/**
 * Message Scheduled webhook schema - exact API match
 */
export const MessageScheduledWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("message_scheduled"),
});

/**
 * Conversation Initiated webhook schema - exact API match
 */
export const ConversationInitedWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("conversation_inited"),
});

/**
 * Message Failed webhook schema - exact API match
 */
export const MessageFailedWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("message_failed"),
  /** Error code (100, 110, 120, 130, 140, 150) */
  error_code: z.number(),
});

/**
 * Message Sent webhook schema - exact API match
 */
export const MessageSentWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("message_sent"),
  /** Indicates if message was delivered successfully */
  success: z.boolean(),
  /** How the message was sent */
  delivery_type: DeliveryTypeSchema.optional(),
});

/**
 * Message Inbound webhook schema - exact API match
 */
export const MessageInboundWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("message_inbound"),
  /** Type of message */
  message_type: MessageTypeSchema,
  /** How the message was received */
  delivery_type: DeliveryTypeSchema.optional(),
  /** Optional array of attachment URLs */
  attachments: z.array(z.string()).optional(),
  /** Optional thread ID for reply-to messages */
  thread_id: z.string().optional(),
  /** Optional group information */
  group: GroupSchema.optional(),
  /** Optional speech transcription for audio messages */
  speech: SpeechSchema.optional(),
});

/**
 * Message Reaction webhook schema - exact API match
 */
export const MessageReactionWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("message_reaction"),
  /** Type of reaction */
  reaction: ReactionTypeSchema,
  /** Type of message */
  message_type: MessageTypeSchema,
});

/**
 * Message Timeout webhook schema - exact API match
 */
export const MessageTimeoutWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("message_timeout"),
  /** Error code (typically 130) */
  error_code: z.number(),
});

/**
 * Group Created webhook schema - exact API match
 */
export const GroupCreatedWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("group_created"),
  /** Group information */
  group: GroupSchema,
});

/**
 * Inbound Call webhook schema - exact API match
 */
export const InboundCallWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("inbound_call"),
});

/**
 * Unknown webhook schema - exact API match
 */
export const UnknownWebhookSchema = BaseWebhookSchema.extend({
  alert_type: z.literal("unknown"),
});

/**
 * Union of all webhook schemas - exact API match
 */
export const LoopWebhookSchema = z.discriminatedUnion("alert_type", [
  MessageScheduledWebhookSchema,
  ConversationInitedWebhookSchema,
  MessageFailedWebhookSchema,
  MessageSentWebhookSchema,
  MessageInboundWebhookSchema,
  MessageReactionWebhookSchema,
  MessageTimeoutWebhookSchema,
  GroupCreatedWebhookSchema,
  InboundCallWebhookSchema,
  UnknownWebhookSchema,
]);

/**
 * Webhook response schema - exact API match
 * Used to show typing indicator and/or mark as read
 */
export const WebhookResponseSchema = z.object({
  /** Show typing indicator for N seconds (max 60) */
  typing: z.number().min(1).max(60).optional(),
  /** Mark chat as read */
  read: z.boolean().optional(),
});

// Export inferred types for backward compatibility
export type AlertType = z.infer<typeof AlertTypeSchema>;
export type MessageType = z.infer<typeof MessageTypeSchema>;
export type DeliveryType = z.infer<typeof DeliveryTypeSchema>;
export type ReactionType = z.infer<typeof ReactionTypeSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type SpeechMetadata = z.infer<typeof SpeechMetadataSchema>;
export type Speech = z.infer<typeof SpeechSchema>;
export type Group = z.infer<typeof GroupSchema>;

export type MessageScheduledWebhook = z.infer<typeof MessageScheduledWebhookSchema>;
export type ConversationInitedWebhook = z.infer<typeof ConversationInitedWebhookSchema>;
export type MessageFailedWebhook = z.infer<typeof MessageFailedWebhookSchema>;
export type MessageSentWebhook = z.infer<typeof MessageSentWebhookSchema>;
export type MessageInboundWebhook = z.infer<typeof MessageInboundWebhookSchema>;
export type MessageReactionWebhook = z.infer<typeof MessageReactionWebhookSchema>;
export type MessageTimeoutWebhook = z.infer<typeof MessageTimeoutWebhookSchema>;
export type GroupCreatedWebhook = z.infer<typeof GroupCreatedWebhookSchema>;
export type InboundCallWebhook = z.infer<typeof InboundCallWebhookSchema>;
export type UnknownWebhook = z.infer<typeof UnknownWebhookSchema>;

export type LoopWebhook = z.infer<typeof LoopWebhookSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;