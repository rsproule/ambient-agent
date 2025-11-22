/**
 * Event Schema for LoopMessage Webhooks
 * 
 * This module uses types directly from the loopmessage-sdk.
 * All webhook handling and types come from the official SDK.
 */

import type { WebhookPayload, InboundMessageWebhook } from "loopmessage-sdk";

/**
 * Re-export SDK types for convenience
 */
export type { WebhookPayload, InboundMessageWebhook };

/**
 * Incoming webhook event payload
 * This is what we pass to our Trigger.dev tasks
 */
export interface IncomingWebhookEvent {
  /**
   * Timestamp when the webhook was received
   */
  timestamp: string;
  
  /**
   * The webhook payload from LoopMessage SDK
   */
  webhook: WebhookPayload;
  
  /**
   * Optional passthrough data
   */
  passthrough?: string;
}

/**
 * Helper to create an incoming webhook event
 */
export function createIncomingWebhookEvent(
  webhook: WebhookPayload,
  passthrough?: string
): IncomingWebhookEvent {
  return {
    timestamp: new Date().toISOString(),
    webhook,
    passthrough: passthrough || webhook.passthrough,
  };
}

/**
 * Type guard for inbound message webhooks
 */
export function isInboundMessage(
  webhook: WebhookPayload
): webhook is InboundMessageWebhook {
  return webhook.type === "message_inbound";
}
