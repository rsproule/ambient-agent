import prisma from "@/src/db/client";
import type { ModelMessage } from "ai";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sender?: string;
  messageId?: string;
  createdAt: Date;
}

/**
 * Get or create a conversation by conversationId (phone number or group_id)
 */
export async function getOrCreateConversation(
  conversationId: string,
  isGroup: boolean = false,
) {
  let conversation = await prisma.conversation.findUnique({
    where: { conversationId },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        conversationId,
        isGroup,
      },
    });
  }

  return conversation;
}

/**
 * Save a user message to the database
 */
export async function saveUserMessage(
  conversationId: string,
  content: string,
  sender: string,
  messageId?: string,
  isGroup: boolean = false,
) {
  const conversation = await getOrCreateConversation(conversationId, isGroup);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content,
      sender,
      messageId,
    },
  });

  // Update conversation's lastMessageAt
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  return message;
}

/**
 * Save an assistant message to the database
 */
export async function saveAssistantMessage(
  conversationId: string,
  content: string,
) {
  const conversation = await getOrCreateConversation(conversationId);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content,
    },
  });

  return message;
}

/**
 * Get the last N messages for a conversation in AI SDK format
 */
export async function getConversationMessages(
  conversationId: string,
  limit: number = 100,
): Promise<ModelMessage[]> {
  const conversation = await prisma.conversation.findUnique({
    where: { conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: limit,
      },
    },
  });

  if (!conversation) {
    return [];
  }

  // Reverse to get chronological order (oldest first)
  const messages = conversation.messages.reverse();

  // Convert to AI SDK format
  return messages.map((msg) => {
    // Add sender name for group messages (helps AI distinguish speakers)
    if (msg.sender && conversation.isGroup && msg.role === "user") {
      return {
        role: "user" as const,
        content: msg.content,
        name: msg.sender,
      };
    }

    return {
      role: msg.role as "user" | "assistant",
      content: msg.content,
    };
  });
}

/**
 * Get the lastMessageAt timestamp for a conversation
 */
export async function getLastMessageTimestamp(
  conversationId: string,
): Promise<Date | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { conversationId },
    select: { lastMessageAt: true },
  });

  return conversation?.lastMessageAt ?? null;
}

/**
 * Check if a conversation has received new messages since a given timestamp
 */
export async function hasNewMessagesSince(
  conversationId: string,
  timestamp: Date,
): Promise<boolean> {
  const lastMessageAt = await getLastMessageTimestamp(conversationId);

  if (!lastMessageAt) {
    return false;
  }

  return lastMessageAt > timestamp;
}

/**
 * Acquire lock for sending messages in a conversation
 */
export async function acquireResponseLock(
  conversationId: string,
  taskId: string,
): Promise<boolean> {
  const conversation = await getOrCreateConversation(conversationId);

  // If there's already an active response, request interrupt
  if (conversation.activeResponseTaskId) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { interruptRequested: true },
    });
    return false;
  }

  // Acquire the lock
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      activeResponseTaskId: taskId,
      interruptRequested: false,
    },
  });

  return true;
}

/**
 * Release the response lock for a conversation
 */
export async function releaseResponseLock(
  conversationId: string,
  taskId: string,
): Promise<void> {
  const conversation = await getOrCreateConversation(conversationId);

  // Only release if this task owns the lock
  if (conversation.activeResponseTaskId === taskId) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        activeResponseTaskId: null,
        interruptRequested: false,
      },
    });
  }
}

/**
 * Check if the current response should be interrupted
 */
export async function shouldInterrupt(
  conversationId: string,
  taskId: string,
): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { conversationId },
    select: { activeResponseTaskId: true, interruptRequested: true },
  });

  if (!conversation) {
    return false;
  }

  // Interrupt if requested and this task is the active one
  return (
    conversation.activeResponseTaskId === taskId &&
    conversation.interruptRequested
  );
}

