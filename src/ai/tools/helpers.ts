/**
 * Helper utilities for integration tools
 */

import { prisma } from "@/src/db/client";
import type { ConversationContext } from "@/src/db/conversation";
import { getUserByPhoneNumber } from "@/src/db/user";
import logger from "@/src/lib/logger";

/**
 * Get the authenticated user ID from conversation context
 * For groups, uses the sender. For DMs, uses the conversationId.
 */
export async function getAuthenticatedUserId(
  context: ConversationContext,
): Promise<string | null> {
  // For group messages, authenticate as the sender
  const phoneNumber = context.isGroup ? context.sender : context.conversationId;

  logger.debug("Getting authenticated user ID", {
    component: "getAuthenticatedUserId",
    isGroup: context.isGroup,
    phoneNumber: phoneNumber || "NOT_SET",
    contextSender: context.sender || "NOT_SET",
  });

  if (!phoneNumber) {
    logger.warn("No phone number available for auth", {
      component: "getAuthenticatedUserId",
      isGroup: context.isGroup,
    });
    return null;
  }

  const user = await getUserByPhoneNumber(phoneNumber);
  logger.debug("User lookup complete", {
    component: "getAuthenticatedUserId",
    phoneNumber,
    userId: user?.id || "NOT_FOUND",
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
