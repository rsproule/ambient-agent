/**
 * LoopMessage Webhook Types
 * Based on official API documentation
 */

/**
 * Alert types from LoopMessage webhooks
 */
export type AlertType =
  | "message_scheduled"
  | "conversation_inited"
  | "message_failed"
  | "message_sent"
  | "message_inbound"
  | "message_reaction"
  | "message_timeout"
  | "group_created"
  | "inbound_call"
  | "unknown";

/**
 * Message types for inbound messages
 */
export type MessageType =
  | "text"
  | "reaction"
  | "audio"
  | "attachments"
  | "sticker"
  | "location";

/**
 * Delivery type
 */
export type DeliveryType = "imessage" | "sms";

/**
 * Reaction types
 */
export type ReactionType =
  | "love"
  | "like"
  | "dislike"
  | "laugh"
  | "exclaim"
  | "question"
  | "unknown";

/**
 * Language information
 */
export interface Language {
  /** ISO 639-1 code (e.g., 'en', 'fr', 'de', 'ja', 'zh') */
  code: string;
  /** Language name (e.g., 'English', 'French', 'German') */
  name: string;
  /** Optional script for Chinese: 'Hans' (Simplified) or 'Hant' (Traditional) */
  script?: "Hans" | "Hant";
}

/**
 * Group information
 */
export interface Group {
  /** Unique ID of iMessage group */
  group_id: string;
  /** Optional custom name for the group */
  name?: string;
  /** Array of participants (phone numbers in E164 format or emails in lowercase) */
  participants: string[];
}

/**
 * Speech metadata
 */
export interface SpeechMetadata {
  /** Words spoken per minute */
  speaking_rate?: number;
  /** Average pause between words in seconds */
  average_pause_duration?: number;
  /** Timestamp of start of speech in audio */
  speech_start_timestamp?: number;
  /** Duration of speech in audio */
  speech_duration?: number;
  /** Vocal stability as percentage */
  jitter?: number;
  /** Vocal stability in decibels */
  shimmer?: number;
  /** Highness/lowness of tone in logarithm of normalized pitch estimates */
  pitch?: number;
  /** Probability of whether a frame is voiced or not */
  voicing?: number;
}

/**
 * Speech transcription
 */
export interface Speech {
  /** Text transcription from audio message */
  text: string;
  /** Language of the speech */
  language: Language;
  /** Optional metadata about the speech */
  metadata?: SpeechMetadata;
}

/**
 * Base webhook payload
 */
interface BaseWebhook {
  /** Unique identifier of your request/message */
  message_id: string;
  /** Unique identifier of the event */
  webhook_id: string;
  /** Type of alert */
  alert_type: AlertType;
  /** API version */
  api_version?: string;
  /** Contact the message is related to */
  recipient?: string;
  /** Message text */
  text?: string;
  /** Optional message subject */
  subject?: string;
  /** Dedicated sender name */
  sender_name?: string;
  /** Custom passthrough data */
  passthrough?: string;
  /** Indicates if related to sandbox contacts */
  sandbox?: boolean;
  /** Dominant language used in the text */
  language?: Language;
}

/**
 * Message Scheduled webhook
 */
export interface MessageScheduledWebhook extends BaseWebhook {
  alert_type: "message_scheduled";
}

/**
 * Conversation Initiated webhook
 */
export interface ConversationInitedWebhook extends BaseWebhook {
  alert_type: "conversation_inited";
}

/**
 * Message Failed webhook
 */
export interface MessageFailedWebhook extends BaseWebhook {
  alert_type: "message_failed";
  /** Error code (100, 110, 120, 130, 140, 150) */
  error_code: number;
}

/**
 * Message Sent webhook
 */
export interface MessageSentWebhook extends BaseWebhook {
  alert_type: "message_sent";
  /** Indicates if message was delivered successfully */
  success: boolean;
  /** How the message was sent */
  delivery_type?: DeliveryType;
}

/**
 * Message Inbound webhook
 */
export interface MessageInboundWebhook extends BaseWebhook {
  alert_type: "message_inbound";
  /** Type of message */
  message_type: MessageType;
  /** How the message was received */
  delivery_type?: DeliveryType;
  /** Optional array of attachment URLs */
  attachments?: string[];
  /** Optional thread ID for reply-to messages */
  thread_id?: string;
  /** Optional group information */
  group?: Group;
  /** Optional speech transcription for audio messages */
  speech?: Speech;
}

/**
 * Message Reaction webhook
 */
export interface MessageReactionWebhook extends BaseWebhook {
  alert_type: "message_reaction";
  /** Type of reaction */
  reaction: ReactionType;
  /** Type of message */
  message_type: MessageType;
}

/**
 * Message Timeout webhook
 */
export interface MessageTimeoutWebhook extends BaseWebhook {
  alert_type: "message_timeout";
  /** Error code (typically 130) */
  error_code: number;
}

/**
 * Group Created webhook
 */
export interface GroupCreatedWebhook extends BaseWebhook {
  alert_type: "group_created";
  /** Group information */
  group: Group;
}

/**
 * Inbound Call webhook
 */
export interface InboundCallWebhook extends BaseWebhook {
  alert_type: "inbound_call";
}

/**
 * Unknown webhook event
 */
export interface UnknownWebhook extends BaseWebhook {
  alert_type: "unknown";
}

/**
 * Union of all webhook types
 */
export type LoopWebhook =
  | MessageScheduledWebhook
  | ConversationInitedWebhook
  | MessageFailedWebhook
  | MessageSentWebhook
  | MessageInboundWebhook
  | MessageReactionWebhook
  | MessageTimeoutWebhook
  | GroupCreatedWebhook
  | InboundCallWebhook
  | UnknownWebhook;

/**
 * Webhook response to show typing indicator and/or mark as read
 */
export interface WebhookResponse {
  /** Show typing indicator for N seconds (max 60) */
  typing?: number;
  /** Mark chat as read */
  read?: boolean;
}

