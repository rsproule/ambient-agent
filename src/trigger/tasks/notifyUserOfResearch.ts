import { saveSystemMessage } from "@/src/db/conversation";
import { getPhoneNumberForUser } from "@/src/db/user";
import { getContextDocuments, getUserContext } from "@/src/db/userContext";
import { task } from "@trigger.dev/sdk/v3";
import { debouncedResponse } from "./debouncedResponse";

type NotifyUserPayload = {
  userId: string;
  jobId: string;
  summary: string;
  triggerType: string;
};

/**
 * Notify user that research has completed
 * Sends a proactive message via Whiskers
 */
export const notifyUserOfResearch = task({
  id: "notify-user-of-research",
  machine: {
    preset: "small-1x",
  },
  run: async (payload: NotifyUserPayload) => {
    const { userId, jobId, summary, triggerType } = payload;

    console.log(`[NotifyUser] Notifying user ${userId} of research completion`);

    // Get user's phone number
    const phoneNumber = await getPhoneNumberForUser(userId);
    if (!phoneNumber) {
      console.log(`[NotifyUser] No phone number found for user ${userId}`);
      return { success: false, reason: "no_phone_number" };
    }

    // Get full context for the notification
    const [context, recentDocs] = await Promise.all([
      getUserContext(userId),
      getContextDocuments(userId, { limit: 5 }),
    ]);

    // Build notification context for Whiskers
    const notificationContext = buildNotificationContext({
      summary,
      triggerType,
      context,
      recentDocs,
    });

    // Save a system message that Whiskers will see
    // This will trigger Whiskers to respond with research findings
    await saveSystemMessage(
      phoneNumber, // conversationId is the phone number for DMs
      notificationContext,
      "research-system",
      false, // not forwarded yet
    );

    // Trigger Whiskers to respond
    await debouncedResponse.trigger({
      conversationId: phoneNumber,
      recipient: phoneNumber,
      timestampWhenTriggered: new Date().toISOString(),
    });

    console.log(`[NotifyUser] Notification triggered for ${phoneNumber}`);

    return {
      success: true,
      phoneNumber,
      jobId,
    };
  },
});

/**
 * Build the notification context message for Whiskers
 */
function buildNotificationContext(params: {
  summary: string;
  triggerType: string;
  context: Awaited<ReturnType<typeof getUserContext>>;
  recentDocs: Awaited<ReturnType<typeof getContextDocuments>>;
}): string {
  const { summary, triggerType, context, recentDocs } = params;

  const parts: string[] = [
    `[SYSTEM: Background research completed - share findings with user]`,
    "",
    `Research Type: ${getTriggerTypeLabel(triggerType)}`,
    `Summary: ${summary}`,
  ];

  // Add key findings from context
  if (context) {
    if (context.interests && context.interests.length > 0) {
      parts.push(`Detected Interests: ${context.interests.join(", ")}`);
    }

    if (context.professional) {
      const prof = context.professional as Record<string, unknown>;
      parts.push(`Professional Info: ${JSON.stringify(prof)}`);
    }
  }

  // Add recent document titles
  if (recentDocs.length > 0) {
    parts.push("");
    parts.push("Recent findings:");
    recentDocs.forEach((doc) => {
      parts.push(`- ${doc.title} (${doc.source})`);
    });
  }

  parts.push("");
  parts.push(
    "Instructions: Share these findings with the user in a friendly, conversational way. " +
      "Don't just list everything - pick the most interesting or relevant things to mention. " +
      "Ask if they'd like to know more or if anything needs correction.",
  );

  return parts.join("\n");
}

/**
 * Get human-readable label for trigger type
 */
function getTriggerTypeLabel(triggerType: string): string {
  switch (triggerType) {
    case "oauth":
      return "Connected account analysis";
    case "conversation":
      return "Information from conversation";
    case "manual":
      return "Requested research";
    case "scheduled":
      return "Scheduled refresh";
    default:
      return "Background research";
  }
}

