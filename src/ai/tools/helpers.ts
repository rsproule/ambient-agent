/**
 * Helper utilities for integration tools
 */

import type { ConversationContext } from "@/src/db/conversation";
import { getUserByPhoneNumber } from "@/src/db/user";
import { prisma } from "@/src/db/client";

/**
 * Get the authenticated user ID from conversation context
 * For groups, uses the sender. For DMs, uses the conversationId.
 */
export async function getAuthenticatedUserId(
  context: ConversationContext,
): Promise<string | null> {
  // For group messages, authenticate as the sender
  const phoneNumber = context.isGroup
    ? context.sender
    : context.conversationId;

  console.log('[getAuthenticatedUserId] Looking up user:', {
    phoneNumber,
    isGroup: context.isGroup,
    sender: context.sender,
    conversationId: context.conversationId,
  });

  if (!phoneNumber) {
    console.log('[getAuthenticatedUserId] No phone number available');
    return null;
  }

  const user = await getUserByPhoneNumber(phoneNumber);
  console.log('[getAuthenticatedUserId] User lookup result:', {
    found: !!user,
    userId: user?.id,
  });
  
  return user?.id ?? null;
}

/**
 * Check if a user has any active connections
 * Used to optimize tool creation - don't create tools if no connections exist
 */
export async function hasActiveConnections(
  context: ConversationContext,
): Promise<boolean> {
  const userId = await getAuthenticatedUserId(context);

  if (!userId) {
    return false;
  }

  const connectionCount = await prisma.connection.count({
    where: {
      userId,
      status: "connected",
    },
  });

  return connectionCount > 0;
}

