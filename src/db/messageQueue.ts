import prisma from "@/src/db/client";
import type {
  CreateQueuedMessageInput,
  MessageTarget,
  BribePayload,
  MessagePayload,
} from "@/src/lib/message-queue/types";
import { MessageStatus } from "@/src/lib/message-queue/types";
import type { Prisma } from "@/src/generated/prisma";

/**
 * Enqueue a new message with pending status
 */
export async function enqueueMessage(
  input: CreateQueuedMessageInput,
): Promise<string> {
  const message = await prisma.queuedMessage.create({
    data: {
      target: input.target as Prisma.InputJsonValue,
      source: input.source,
      bribePayload: input.bribePayload as Prisma.InputJsonValue | undefined,
      payload: input.payload as Prisma.InputJsonValue,
      status: MessageStatus.PENDING,
    },
  });

  return message.id;
}

/**
 * Get the next batch of pending messages, ordered by creation time
 */
export async function getNextMessages(limit: number = 10) {
  const messages = await prisma.queuedMessage.findMany({
    where: {
      status: MessageStatus.PENDING,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  return messages.map((msg) => ({
    id: msg.id,
    target: msg.target as MessageTarget,
    source: msg.source,
    bribePayload: msg.bribePayload as BribePayload | undefined,
    payload: msg.payload as MessagePayload,
    status: msg.status as MessageStatus,
    processedAt: msg.processedAt ?? undefined,
    error: msg.error ?? undefined,
    createdAt: msg.createdAt,
  }));
}

/**
 * Mark a message as processing
 */
export async function markMessageProcessing(messageId: string): Promise<void> {
  await prisma.queuedMessage.update({
    where: { id: messageId },
    data: {
      status: MessageStatus.PROCESSING,
    },
  });
}

/**
 * Mark a message as completed with timestamp
 */
export async function markMessageCompleted(messageId: string): Promise<void> {
  await prisma.queuedMessage.update({
    where: { id: messageId },
    data: {
      status: MessageStatus.COMPLETED,
      processedAt: new Date(),
      error: null,
    },
  });
}

/**
 * Mark a message as failed with error message
 */
export async function markMessageFailed(
  messageId: string,
  error: string,
): Promise<void> {
  await prisma.queuedMessage.update({
    where: { id: messageId },
    data: {
      status: MessageStatus.FAILED,
      processedAt: new Date(),
      error,
    },
  });
}

/**
 * Get message by ID
 */
export async function getMessageById(messageId: string) {
  const msg = await prisma.queuedMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) return null;

  return {
    id: msg.id,
    target: msg.target as MessageTarget,
    source: msg.source,
    bribePayload: msg.bribePayload as BribePayload | undefined,
    payload: msg.payload as MessagePayload,
    status: msg.status as MessageStatus,
    processedAt: msg.processedAt ?? undefined,
    error: msg.error ?? undefined,
    createdAt: msg.createdAt,
  };
}

/**
 * Get messages by status
 */
export async function getMessagesByStatus(
  status: MessageStatus,
  limit: number = 100,
) {
  const messages = await prisma.queuedMessage.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return messages.map((msg) => ({
    id: msg.id,
    target: msg.target as MessageTarget,
    source: msg.source,
    bribePayload: msg.bribePayload as BribePayload | undefined,
    payload: msg.payload as MessagePayload,
    status: msg.status as MessageStatus,
    processedAt: msg.processedAt ?? undefined,
    error: msg.error ?? undefined,
    createdAt: msg.createdAt,
  }));
}

