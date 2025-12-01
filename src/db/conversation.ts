import type {
  SystemState,
  UserResearchContext,
} from "@/src/ai/agents/systemPrompt";
import prisma from "@/src/db/client";
import { getUserConnections } from "@/src/db/connection";
import { getUserContextByPhone } from "@/src/db/userContext";
import type { Prisma } from "@/src/generated/prisma";
import type { ModelMessage } from "ai";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sender?: string;
  messageId?: string;
  createdAt: Date;
}

export interface ConversationContext {
  conversationId: string; // Phone number or group_id
  isGroup: boolean;
  groupName?: string;
  participants: string[];
  summary?: string; // Optional: compressed context summary for future use
  sender?: string; // Phone number of the user who sent the last message (for tool auth)
  userContext?: UserResearchContext | null; // Research-based user context
  systemState?: SystemState | null; // Connection status and other system state
}

/**
 * Get or create a conversation by conversationId (phone number or group_id)
 */
export async function getOrCreateConversation(
  conversationId: string,
  isGroup: boolean = false,
  groupName?: string,
  participants: string[] = [],
) {
  let conversation = await prisma.conversation.findUnique({
    where: { conversationId },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        conversationId,
        isGroup,
        groupName,
        participants,
      },
    });
  } else if (isGroup && participants.length > 0) {
    // Update participants if this is a group and we have new participant data
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        groupName,
        participants,
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
  attachments: string[] = [],
  groupName?: string,
  participants: string[] = [],
) {
  const conversation = await getOrCreateConversation(
    conversationId,
    isGroup,
    groupName,
    participants,
  );

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: content as Prisma.InputJsonValue,
      sender,
      messageId,
      attachments,
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
 * Supports both string content and structured content (for tool calls)
 */
export async function saveAssistantMessage(
  conversationId: string,
  content: string | object,
  messageId?: string,
) {
  const conversation = await getOrCreateConversation(conversationId);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: content as Prisma.InputJsonValue,
      messageId,
      attachments: [], // Assistant messages can have attachments too
    },
  });

  return message;
}

/**
 * Save a system message to the database (merchant/service messages to be delivered)
 */
export async function saveSystemMessage(
  conversationId: string,
  content: string,
  source: string,
  forwarded?: boolean,
  rejectionReason?: string,
) {
  const conversation = await getOrCreateConversation(conversationId);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "system",
      content: content as Prisma.InputJsonValue,
      sender: source, // Track the merchant/service source
      attachments: [],
      forwarded,
      rejectionReason,
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
 * Update system message forwarding status
 */
export async function updateSystemMessageStatus(
  messageId: string,
  forwarded: boolean,
  rejectionReason?: string,
) {
  await prisma.message.update({
    where: { id: messageId },
    data: {
      forwarded,
      rejectionReason,
    },
  });
}

/**
 * Update a message's messageId (for when we get the webhook confirmation)
 */
export async function updateMessageId(
  internalMessageId: string,
  loopMessageId: string,
) {
  await prisma.message.update({
    where: { id: internalMessageId },
    data: { messageId: loopMessageId },
  });
}

/**
 * Get the last N messages for a conversation in AI SDK format
 * Returns both messages and conversation context
 */
export async function getConversationMessages(
  conversationId: string,
  limit: number = 100,
): Promise<{ messages: ModelMessage[]; context: ConversationContext }> {
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
    return {
      messages: [],
      context: {
        conversationId,
        isGroup: false,
        participants: [],
      },
    };
  }

  // Reverse to get chronological order (oldest first)
  const messages = conversation.messages.reverse();
  // Convert to AI SDK format with preprocessing
  const formattedMessages = messages
    .map((msg) => formatMessageForAI(msg, conversation.isGroup))
    .filter((msg) => !isEmptyMessage(msg))
    .filter((msg) => {
      // Filter out assistant messages with incomplete tool calls
      // These cause "tool_use without tool_result" errors in Claude API
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        const hasToolUse = msg.content.some(
          (block: { type?: string }) => block.type === "tool_use",
        );
        if (hasToolUse) {
          console.warn(
            `[getConversationMessages] Filtering out assistant message with tool_use blocks to prevent API errors`,
          );
          return false;
        }
      }
      return true;
    });

  // Get the sender of the last user message (for tool authentication)
  // This is critical for group messages where tools should auth as the sender
  const lastUserMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === "user" && msg.sender);
  const sender = lastUserMessage?.sender ?? undefined;

  // Fetch user research context and system state for direct messages
  let userContext: UserResearchContext | null = null;
  let systemState: SystemState | null = null;

  if (!conversation.isGroup && sender) {
    try {
      // Get user by phone number to fetch their connections and outbound opt-in
      const user = await prisma.user.findUnique({
        where: { phoneNumber: sender },
        select: { id: true, outboundOptIn: true },
      });

      if (user) {
        // Fetch research context
        const researchContext = await getUserContextByPhone(sender);
        if (researchContext) {
          userContext = {
            summary: researchContext.summary,
            interests: researchContext.interests,
            professional: researchContext.professional,
            facts: researchContext.facts,
            recentDocuments: researchContext.documents
              ?.slice(0, 5)
              .map((d) => ({
                title: d.title,
                source: d.source,
              })),
          };
        }

        // Fetch connection status
        const connections = await getUserConnections(user.id);
        const gmailConnected = connections.some(
          (c) => c.provider === "google_gmail" && c.status === "connected",
        );
        const githubConnected = connections.some(
          (c) => c.provider === "github" && c.status === "connected",
        );
        const calendarConnected = connections.some(
          (c) => c.provider === "google_calendar" && c.status === "connected",
        );

        systemState = {
          connections: {
            gmail: gmailConnected,
            github: githubConnected,
            calendar: calendarConnected,
          },
          hasAnyConnection:
            gmailConnected || githubConnected || calendarConnected,
          researchStatus: researchContext ? "completed" : "none",
          outboundOptIn: user.outboundOptIn,
        };
      }
    } catch (error) {
      console.warn(
        `[getConversationMessages] Failed to fetch user context:`,
        error,
      );
    }
  }

  return {
    messages: formattedMessages,
    context: {
      conversationId,
      isGroup: conversation.isGroup,
      groupName: conversation.groupName ?? undefined,
      participants: conversation.participants,
      summary: conversation.summary ?? undefined,
      sender,
      userContext,
      systemState,
    },
  };
}

/**
 * Format a single message for AI consumption
 */
function formatMessageForAI(
  msg: {
    role: string;
    content: unknown; // Can be string or structured JSON (for tool calls)
    messageId: string | null;
    sender: string | null;
    attachments: string[];
  },
  isGroup: boolean,
): ModelMessage {
  // If content is already structured (JSON object/array), use it directly for assistant messages
  // This preserves tool_use and tool_result blocks
  if (msg.role === "assistant" && typeof msg.content !== "string") {
    return {
      role: "assistant",
      content: msg.content,
    } as ModelMessage;
  }

  // For string content, apply formatting
  const content = buildMessageContent(msg);

  // System messages (merchant/service messages to be delivered)
  if (msg.role === "system") {
    return {
      role: "user",
      content: `[SYSTEM: Deliver this message from ${msg.sender}]\n${content}`,
    } as ModelMessage;
  }

  // Group chat user messages include sender name
  if (msg.role === "user" && isGroup && msg.sender) {
    return { role: "user", content, name: msg.sender } as ModelMessage;
  }

  if (msg.role === "user") {
    return { role: "user", content } as ModelMessage;
  }

  return { role: "assistant", content } as ModelMessage;
}

/**
 * Build message content with attachments and message ID
 */
function buildMessageContent(msg: {
  content: unknown; // Can be string or structured content
  messageId: string | null;
  attachments: string[];
}):
  | string
  | Array<{ type: "text"; text: string } | { type: "image"; image: string }> {
  // If content is not a string (structured content), we can't format it further
  // This should only happen for assistant messages with tool calls which are handled separately
  if (typeof msg.content !== "string") {
    return msg.content as Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    >;
  }

  const hasAttachments = msg.attachments && msg.attachments.length > 0;

  // Simple text-only message
  if (!hasAttachments) {
    return msg.messageId
      ? `[msg_id: ${msg.messageId}] ${msg.content}`
      : msg.content;
  }

  // Multi-part message with attachments
  const parts: Array<
    { type: "text"; text: string } | { type: "image"; image: string }
  > = [];

  if (msg.messageId) {
    parts.push({ type: "text", text: `[msg_id: ${msg.messageId}]` });
  }

  if (msg.content?.trim()) {
    parts.push({ type: "text", text: msg.content });
  }

  for (const url of msg.attachments) {
    parts.push({ type: "image", image: url });
  }

  return parts;
}

/**
 * Check if a message is empty and should be filtered out
 */
function isEmptyMessage(msg: ModelMessage): boolean {
  if (typeof msg.content === "string") {
    return msg.content.trim().length === 0;
  }
  return msg.content.length === 0;
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
