/**
 * Group Chat Settings Database Helpers
 *
 * Manages per-group-chat custom prompts that define AI behavior.
 * The custom prompt is injected into the system prompt for that conversation.
 */

import prisma from "@/src/db/client";

/**
 * Get the custom prompt for a group chat conversation
 * Returns null if no custom prompt has been set
 */
export async function getGroupChatCustomPrompt(
  conversationId: string,
): Promise<string | null> {
  const settings = await prisma.groupChatSettings.findUnique({
    where: { conversationId },
    select: { customPrompt: true },
  });

  return settings?.customPrompt ?? null;
}

/**
 * Set or update the custom prompt for a group chat
 * Pass null to clear the custom prompt
 */
export async function setGroupChatCustomPrompt(
  conversationId: string,
  customPrompt: string | null,
): Promise<void> {
  await prisma.groupChatSettings.upsert({
    where: { conversationId },
    create: {
      conversationId,
      customPrompt,
    },
    update: {
      customPrompt,
    },
  });
}

/**
 * Delete group chat settings (clears custom prompt)
 */
export async function deleteGroupChatSettings(
  conversationId: string,
): Promise<void> {
  await prisma.groupChatSettings
    .delete({
      where: { conversationId },
    })
    .catch(() => {
      // Ignore if settings don't exist
    });
}
