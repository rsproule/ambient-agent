import { z } from "zod";
import { loopWebhookSchema, type LoopWebhook } from "./schemas";

/**
 * Parse and validate a LoopMessage webhook payload
 */
export function parseLoopWebhook(rawBody: string): LoopWebhook {
  const parsed = JSON.parse(rawBody);
  return loopWebhookSchema.parse(parsed);
}

/**
 * Validate webhook authentication
 */
export function validateWebhookAuth(
  authHeader: string | null,
  expectedToken: string,
): boolean {
  if (!authHeader) return false;

  // Handle both "Bearer token" and "token" formats
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1] === expectedToken;
  } else if (parts.length === 1) {
    return authHeader === expectedToken;
  }

  return false;
}

/**
 * Create a webhook response with typing indicator and read receipt
 */
export function createWebhookResponse(options?: {
  typing?: number;
  read?: boolean;
}) {
  return {
    success: true,
    typing: options?.typing ?? 3,
    read: options?.read ?? true,
  };
}

/**
 * Type guard to check if webhook is a message_inbound event
 */
export function isMessageInbound(
  webhook: LoopWebhook,
): webhook is Extract<LoopWebhook, { alert_type: "message_inbound" }> {
  return webhook.alert_type === "message_inbound";
}

/**
 * Type guard to check if webhook is a message_sent event
 */
export function isMessageSent(
  webhook: LoopWebhook,
): webhook is Extract<LoopWebhook, { alert_type: "message_sent" }> {
  return webhook.alert_type === "message_sent";
}

/**
 * Type guard to check if webhook is a message_failed event
 */
export function isMessageFailed(
  webhook: LoopWebhook,
): webhook is Extract<LoopWebhook, { alert_type: "message_failed" }> {
  return webhook.alert_type === "message_failed";
}

/**
 * Type guard to check if webhook is a message_reaction event
 */
export function isMessageReaction(
  webhook: LoopWebhook,
): webhook is Extract<LoopWebhook, { alert_type: "message_reaction" }> {
  return webhook.alert_type === "message_reaction";
}

