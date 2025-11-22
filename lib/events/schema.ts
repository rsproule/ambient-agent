import { z } from "zod";

/**
 * Unified Event Schema System
 * 
 * This schema defines the normalized event structure that all webhook sources
 * (LoopMessage, SendBlue, etc.) will be transformed into before being sent
 * to Trigger.dev for processing.
 */

// Event source - which service the webhook came from
export const eventSourceSchema = z.enum([
  "loopmessage",
  "sendblue",
]);

// Event types - all possible event types across all sources
export const eventTypeSchema = z.enum([
  "message_inbound",
  "message_sent",
  "message_failed",
  "message_reaction",
  "message_typing",
  "message_read",
  "auth_response",
  "group_created",
]);

// Normalized event data - common fields extracted from source-specific payloads
export const normalizedEventSchema = z.object({
  // Sender information
  sender: z.string().optional(),
  
  // Recipient information
  recipient: z.string().optional(),
  
  // Message content
  text: z.string().optional(),
  
  // Group context
  groupId: z.string().optional(),
  
  // Message metadata
  messageId: z.string().optional(),
  messageType: z.string().optional(),
  
  // Attachments
  attachments: z.array(z.string()).optional(),
  
  // Audio transcription
  speechText: z.string().optional(),
  
  // Reactions
  reaction: z.string().optional(),
  
  // Error information (for failed messages)
  errorCode: z.number().optional(),
  errorMessage: z.string().optional(),
  
  // Reply context
  replyToId: z.string().optional(),
  
  // Group information
  groupName: z.string().optional(),
  participants: z.array(z.string()).optional(),
  creator: z.string().optional(),
  
  // Auth response
  requestId: z.string().optional(),
});

// Incoming event payload - the complete normalized event structure
export const incomingEventPayloadSchema = z.object({
  // Event metadata
  source: eventSourceSchema,
  type: eventTypeSchema,
  timestamp: z.string(),
  
  // Normalized event data
  normalized: normalizedEventSchema,
  
  // Raw payload from the source (for debugging and advanced processing)
  rawPayload: z.unknown(),
  
  // Optional passthrough data
  passthrough: z.string().optional(),
});

// Infer TypeScript types from Zod schemas
export type EventSource = z.infer<typeof eventSourceSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;
export type IncomingEventPayload = z.infer<typeof incomingEventPayloadSchema>;

/**
 * Helper function to create a basic incoming event payload
 */
export function createIncomingEvent(
  source: EventSource,
  type: EventType,
  normalized: NormalizedEvent,
  rawPayload: unknown,
  passthrough?: string,
): IncomingEventPayload {
  return {
    source,
    type,
    timestamp: new Date().toISOString(),
    normalized,
    rawPayload,
    passthrough,
  };
}

