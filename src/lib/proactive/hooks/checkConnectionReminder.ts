/**
 * Connection Reminder Hook
 *
 * Reminds users who haven't connected any accounts to do so.
 * Note: The schedule/cooldown for this hook is managed by the proactiveUserCheck task,
 * so we don't need to check timing here - just whether to notify.
 */

import type { HookContext, HookResult } from "../types";

/**
 * Check if we should remind user to connect accounts
 * @param _reminderDays - Unused, kept for backwards compatibility. Scheduling is handled externally.
 */
export async function checkConnectionReminder(
  context: HookContext,
  _reminderDays: number = 7,
): Promise<HookResult> {
  // Skip if user has any connections
  const hasAnyConnection =
    context.connections.gmail ||
    context.connections.github ||
    context.connections.calendar;

  if (hasAnyConnection) {
    return { shouldNotify: false };
  }

  // Check if we've already mentioned connections in recent messages (dedup)
  const recentlyMentioned = context.recentMessages.some(
    (msg) =>
      typeof msg.content === "string" &&
      (msg.content.includes("connection:reminder") ||
        msg.content.toLowerCase().includes("connect your") ||
        msg.content.toLowerCase().includes("link your")),
  );

  if (recentlyMentioned) {
    return { shouldNotify: false };
  }

  const signature = `connection:reminder:${Date.now()}`;

  const message =
    `[SYSTEM: Gentle connection reminder - be casual and helpful, not pushy]\n` +
    `[${signature}]\n` +
    `The user hasn't connected any accounts yet. ` +
    `You could mention that connecting Gmail, GitHub, or Calendar would help you be more useful ` +
    `(like proactive reminders about meetings or PR reviews). ` +
    `Keep it casual and only mention if it fits naturally in conversation.`;

  return {
    shouldNotify: true,
    message,
    contentSignature: signature,
    metadata: {
      noConnections: true,
    },
  };
}
