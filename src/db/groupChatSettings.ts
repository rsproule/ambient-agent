/**
 * Group Chat Settings Database Helpers
 *
 * Manages per-group-chat configuration for AI behavior including:
 * - Response triggers (mention-only vs all messages)
 * - Custom mention keywords
 * - Proactive messaging permissions
 */

import prisma from "@/src/db/client";
import type { GroupChatSettings } from "@/src/generated/prisma";

/**
 * Default mention keywords used when no custom keywords are set
 */
export const DEFAULT_MENTION_KEYWORDS = ["mr whiskers", "whiskers", "@whiskers"];

/**
 * Group chat settings with defaults applied
 */
export interface GroupChatSettingsWithDefaults {
  conversationId: string;
  respondOnlyWhenMentioned: boolean;
  mentionKeywords: string[];
  allowProactiveMessages: boolean;
}

/**
 * Get group chat settings for a conversation, applying defaults if not set
 */
export async function getGroupChatSettings(
  conversationId: string,
): Promise<GroupChatSettingsWithDefaults> {
  const settings = await prisma.groupChatSettings.findUnique({
    where: { conversationId },
  });

  // Return settings with defaults applied
  return {
    conversationId,
    respondOnlyWhenMentioned: settings?.respondOnlyWhenMentioned ?? true,
    mentionKeywords:
      settings?.mentionKeywords && settings.mentionKeywords.length > 0
        ? settings.mentionKeywords
        : DEFAULT_MENTION_KEYWORDS,
    allowProactiveMessages: settings?.allowProactiveMessages ?? false,
  };
}

/**
 * Get raw group chat settings (null if not set)
 */
export async function getRawGroupChatSettings(
  conversationId: string,
): Promise<GroupChatSettings | null> {
  return prisma.groupChatSettings.findUnique({
    where: { conversationId },
  });
}

/**
 * Input for creating/updating group chat settings
 */
export interface GroupChatSettingsInput {
  respondOnlyWhenMentioned?: boolean;
  mentionKeywords?: string[];
  allowProactiveMessages?: boolean;
}

/**
 * Create or update group chat settings
 */
export async function upsertGroupChatSettings(
  conversationId: string,
  input: GroupChatSettingsInput,
): Promise<GroupChatSettings> {
  return prisma.groupChatSettings.upsert({
    where: { conversationId },
    create: {
      conversationId,
      respondOnlyWhenMentioned: input.respondOnlyWhenMentioned ?? true,
      mentionKeywords: input.mentionKeywords ?? [],
      allowProactiveMessages: input.allowProactiveMessages ?? false,
    },
    update: {
      ...(input.respondOnlyWhenMentioned !== undefined && {
        respondOnlyWhenMentioned: input.respondOnlyWhenMentioned,
      }),
      ...(input.mentionKeywords !== undefined && {
        mentionKeywords: input.mentionKeywords,
      }),
      ...(input.allowProactiveMessages !== undefined && {
        allowProactiveMessages: input.allowProactiveMessages,
      }),
    },
  });
}

/**
 * Delete group chat settings (resets to defaults)
 */
export async function deleteGroupChatSettings(
  conversationId: string,
): Promise<void> {
  await prisma.groupChatSettings.delete({
    where: { conversationId },
  }).catch(() => {
    // Ignore if settings don't exist
  });
}

/**
 * Check if a message text contains any of the mention keywords
 * Case-insensitive matching
 */
export function messageContainsMention(
  messageText: string,
  keywords: string[],
): boolean {
  const lowerMessage = messageText.toLowerCase();
  return keywords.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase()),
  );
}

/**
 * Determine if the AI should respond to a message in a group chat
 * based on the group's settings and message content
 */
export function shouldRespondInGroupChat(
  messageText: string,
  settings: GroupChatSettingsWithDefaults,
): boolean {
  // If respond to all messages, always respond
  if (!settings.respondOnlyWhenMentioned) {
    return true;
  }

  // Check if message contains any mention keywords
  return messageContainsMention(messageText, settings.mentionKeywords);
}

