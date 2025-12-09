/**
 * Task event logging utilities
 *
 * Provides consistent event logging for background tasks.
 */

import { logEvent } from "@/src/db/events";
import logger from "@/src/lib/logger";

interface TaskContext {
  taskId: string;
  taskName: string;
  conversationId?: string;
  userId?: string;
}

/**
 * Log task started event
 */
export async function logTaskStarted(
  ctx: TaskContext,
  payload?: Record<string, unknown>,
): Promise<void> {
  await logEvent({
    conversationId: ctx.conversationId,
    userId: ctx.userId,
    type: "system",
    source: `task:${ctx.taskName}`,
    payload: {
      event: "task_started",
      taskId: ctx.taskId,
      taskName: ctx.taskName,
      ...payload,
    },
  });

  logger.info(`Task started: ${ctx.taskName}`, {
    taskId: ctx.taskId,
    conversationId: ctx.conversationId,
  });
}

/**
 * Log task completed event
 */
export async function logTaskCompleted(
  ctx: TaskContext,
  result?: Record<string, unknown>,
  durationMs?: number,
): Promise<void> {
  await logEvent({
    conversationId: ctx.conversationId,
    userId: ctx.userId,
    type: "system",
    source: `task:${ctx.taskName}`,
    payload: {
      event: "task_completed",
      taskId: ctx.taskId,
      taskName: ctx.taskName,
      durationMs,
      result,
    },
  });

  logger.info(`Task completed: ${ctx.taskName}`, {
    taskId: ctx.taskId,
    conversationId: ctx.conversationId,
    durationMs,
  });
}

/**
 * Log task failed event
 */
export async function logTaskFailed(
  ctx: TaskContext,
  error: Error | string,
  durationMs?: number,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  await logEvent({
    conversationId: ctx.conversationId,
    userId: ctx.userId,
    type: "error",
    source: `task:${ctx.taskName}`,
    payload: {
      event: "task_failed",
      taskId: ctx.taskId,
      taskName: ctx.taskName,
      error: errorMessage,
      stack: errorStack,
      durationMs,
    },
  });

  logger.error(`Task failed: ${ctx.taskName}`, {
    taskId: ctx.taskId,
    conversationId: ctx.conversationId,
    error: errorMessage,
    durationMs,
  });
}

/**
 * Log a custom task event
 */
export async function logTaskEvent(
  ctx: TaskContext,
  eventName: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await logEvent({
    conversationId: ctx.conversationId,
    userId: ctx.userId,
    type: "app_event",
    source: `task:${ctx.taskName}`,
    payload: {
      event: eventName,
      taskId: ctx.taskId,
      taskName: ctx.taskName,
      ...payload,
    },
  });
}
