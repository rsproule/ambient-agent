import { getUserById } from "@/src/db/user";
import type { MessageTarget } from "@/src/lib/message-queue/types";
import {
  isSegmentTarget,
  isUserTarget,
} from "@/src/lib/message-queue/types";

export interface Recipient {
  userId: string;
  conversationId: string; // phone number for DMs
  phoneNumber: string;
}

/**
 * Resolve recipients based on target type
 *
 * - For user_id: Returns single user if they have a phone number
 * - For segment: Currently placeholder - returns empty array (implement segment logic as needed)
 *
 * @param target The message target
 * @returns Array of recipients with userId, conversationId (phone), and phoneNumber
 */
export async function resolveRecipients(
  target: MessageTarget,
): Promise<Recipient[]> {
  if (isUserTarget(target)) {
    return resolveUserRecipient(target.userId);
  } else if (isSegmentTarget(target)) {
    return resolveSegmentRecipients(target.segmentId);
  }

  throw new Error(`Unknown target type: ${JSON.stringify(target)}`);
}

/**
 * Resolve a single user recipient
 */
async function resolveUserRecipient(userId: string): Promise<Recipient[]> {
  const user = await getUserById(userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  if (!user.phoneNumber) {
    throw new Error(
      `User ${userId} does not have a phone number. Cannot send message.`,
    );
  }

  return [
    {
      userId: user.id,
      conversationId: user.phoneNumber, // For DMs, conversationId is the phone number
      phoneNumber: user.phoneNumber,
    },
  ];
}

/**
 * Resolve recipients for a segment
 *
 * TODO: Implement segment logic
 * This is a placeholder that returns an empty array.
 *
 * To implement:
 * 1. Create a Segment model in Prisma schema with segment definition
 * 2. Query users matching the segment criteria
 * 3. Return users with phone numbers
 *
 * Example segment types:
 * - User metadata filters (e.g., "premium_users")
 * - Behavior-based segments (e.g., "active_last_30_days")
 * - Explicitly defined user lists
 */
async function resolveSegmentRecipients(
  segmentId: string,
): Promise<Recipient[]> {
  console.warn(
    `Segment targeting not yet implemented. Segment: ${segmentId}. Returning empty recipient list.`,
  );

  // TODO: Implement segment resolution
  // Example implementation:
  // const segment = await getSegmentById(segmentId);
  // const users = await getUsersInSegment(segment);
  // return users
  //   .filter(user => user.phoneNumber)
  //   .map(user => ({
  //     userId: user.id,
  //     conversationId: user.phoneNumber!,
  //     phoneNumber: user.phoneNumber!,
  //   }));

  return [];
}

/**
 * Validate that all recipients have required fields
 */
export function validateRecipients(recipients: Recipient[]): void {
  for (const recipient of recipients) {
    if (!recipient.userId) {
      throw new Error("Recipient missing userId");
    }
    if (!recipient.conversationId) {
      throw new Error(`Recipient ${recipient.userId} missing conversationId`);
    }
    if (!recipient.phoneNumber) {
      throw new Error(`Recipient ${recipient.userId} missing phoneNumber`);
    }
  }
}
