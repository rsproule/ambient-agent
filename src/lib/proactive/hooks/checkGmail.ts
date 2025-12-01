/**
 * Gmail Hook
 *
 * Checks for important unread emails
 */

import {
  getGmailMessage,
  listGmailMessages,
} from "@/src/lib/integrations/gmail";
import type { HookContext, HookResult } from "../types";

/**
 * Check for important unread emails
 */
export async function checkGmail(context: HookContext): Promise<HookResult> {
  // Skip if Gmail not connected
  if (!context.connections.gmail) {
    return { shouldNotify: false };
  }

  try {
    // Get recent unread messages from inbox
    const messages = await listGmailMessages(context.userId, {
      maxResults: 10,
      labelIds: ["INBOX", "UNREAD"],
    });

    if (!messages.messages || messages.messages.length === 0) {
      return { shouldNotify: false };
    }

    // Get details of the most recent unread messages
    const emailDetails: Array<{
      id: string;
      subject: string;
      from: string;
      snippet: string;
      isImportant: boolean;
    }> = [];

    for (const msg of messages.messages.slice(0, 5)) {
      if (!msg.id) continue;

      try {
        const details = await getGmailMessage(context.userId, msg.id);

        const subject =
          details.payload?.headers?.find(
            (h) => h.name?.toLowerCase() === "subject",
          )?.value || "No subject";

        const from =
          details.payload?.headers?.find(
            (h) => h.name?.toLowerCase() === "from",
          )?.value || "Unknown sender";

        const isImportant =
          details.labelIds?.includes("IMPORTANT") ||
          details.labelIds?.includes("STARRED") ||
          false;

        emailDetails.push({
          id: msg.id,
          subject,
          from,
          snippet: details.snippet || "",
          isImportant,
        });
      } catch {
        continue;
      }
    }

    if (emailDetails.length === 0) {
      return { shouldNotify: false };
    }

    // Filter to emails we haven't notified about
    // Also prioritize important emails
    const importantEmails = emailDetails.filter((e) => e.isImportant);
    const emailsToNotify =
      importantEmails.length > 0 ? importantEmails : emailDetails;

    const newEmails = emailsToNotify.filter((email) => {
      const signature = `gmail:unread:${email.id}`;
      const alreadyNotified = context.recentMessages.some(
        (msg) =>
          typeof msg.content === "string" && msg.content.includes(signature),
      );
      return !alreadyNotified;
    });

    if (newEmails.length === 0) {
      return { shouldNotify: false };
    }

    // Build notification message
    const email = newEmails[0];
    const signature = `gmail:unread:${email.id}`;

    // Extract sender name from "Name <email>" format
    const senderMatch = email.from.match(/^([^<]+)/);
    const senderName = senderMatch ? senderMatch[1].trim() : email.from;

    const importantTag = email.isImportant ? " (marked important)" : "";

    const message =
      `[SYSTEM: Proactive email notification - share with user naturally]\n` +
      `[${signature}]\n` +
      `You have an unread email${importantTag} from ${senderName}: "${email.subject}"` +
      (newEmails.length > 1
        ? ` (plus ${newEmails.length - 1} other unread)`
        : "");

    return {
      shouldNotify: true,
      message,
      contentSignature: signature,
      metadata: {
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        isImportant: email.isImportant,
        totalUnread: newEmails.length,
      },
    };
  } catch (error) {
    console.error("[checkGmail] Error checking Gmail:", error);
    return { shouldNotify: false };
  }
}

