/**
 * Event logging for conversation activity tracking
 *
 * Append-only event log for debugging, analytics, and audit trails.
 */

import logger from "@/src/lib/logger";
import prisma from "./client";

export type EventType =
  | "message_in"
  | "message_out"
  | "app_launch"
  | "app_exit"
  | "app_event"
  | "tool_call"
  | "system"
  | "error";

export type EventSource =
  | "user"
  | "assistant"
  | "system"
  | "webhook"
  | `app:${string}`
  | `task:${string}`;

interface LogEventParams {
  conversationId?: string;
  userId?: string;
  type: EventType;
  source: EventSource;
  payload: Record<string, unknown>;
}

/**
 * Log an event to the Event table
 */
export async function logEvent({
  conversationId,
  userId,
  type,
  source,
  payload,
}: LogEventParams): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        conversationId,
        userId,
        type,
        source,
        payload: payload as object,
      },
    });
  } catch (error) {
    // Don't let event logging failures break the main flow
    logger.error("Failed to log event", {
      error,
      type,
      source,
      conversationId,
    });
  }
}

/**
 * Log incoming message
 */
export async function logMessageIn(
  conversationId: string,
  payload: {
    sender?: string;
    content: string;
    messageId?: string;
    isGroup?: boolean;
  },
): Promise<void> {
  await logEvent({
    conversationId,
    userId: payload.sender,
    type: "message_in",
    source: "user",
    payload,
  });
}

/**
 * Log outgoing message
 */
export async function logMessageOut(
  conversationId: string,
  payload: {
    content: string;
    messageId?: string;
    deliveryStatus?: string;
  },
): Promise<void> {
  await logEvent({
    conversationId,
    type: "message_out",
    source: "assistant",
    payload,
  });
}

/**
 * Log app launch
 */
export async function logAppLaunch(
  conversationId: string,
  appId: string,
  reason?: string,
): Promise<void> {
  await logEvent({
    conversationId,
    type: "app_launch",
    source: `app:${appId}`,
    payload: { appId, reason },
  });
}

/**
 * Log app exit
 */
export async function logAppExit(
  conversationId: string,
  appId: string,
  reason?: string,
): Promise<void> {
  await logEvent({
    conversationId,
    type: "app_exit",
    source: `app:${appId}`,
    payload: { appId, reason },
  });
}

/**
 * Log tool call
 */
export async function logToolCall(
  conversationId: string,
  payload: {
    toolName: string;
    input?: unknown;
    output?: unknown;
    success: boolean;
    error?: string;
    durationMs?: number;
  },
): Promise<void> {
  await logEvent({
    conversationId,
    type: "tool_call",
    source: "assistant",
    payload,
  });
}

/**
 * Log error
 */
export async function logError(
  conversationId: string | undefined,
  payload: {
    error: string;
    context?: string;
    stack?: string;
  },
): Promise<void> {
  await logEvent({
    conversationId,
    type: "error",
    source: "system",
    payload,
  });
}

/**
 * Log system event
 */
export async function logSystemEvent(
  conversationId: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  await logEvent({
    conversationId,
    type: "system",
    source: "system",
    payload,
  });
}
