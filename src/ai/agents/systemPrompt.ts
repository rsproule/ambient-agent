import type { GroupChatSettingsWithDefaults } from "@/src/db/groupChatSettings";
import { ONBOARDING_PROMPT } from "./onboardingPrompt";

/**
 * Base system prompt for iMessage interaction
 *
 * This contains all the technical requirements for interacting with iMessage
 * via the actions interface. It's personality-agnostic and can be reused
 * with any agent personality.
 */

export const IMESSAGE_SYSTEM_PROMPT = `
Message IDs:
- User messages include a message ID in the format: [msg_id: ABC123]
- To react to a message, extract the message_id from the brackets
- Example: If you see "[msg_id: 47889688-Bc6a-4524-911D-3D0B0AD3860C] hey what's up", the message_id is "47889688-Bc6a-4524-911D-3D0B0AD3860C"

Output Format:
Generate an array of actions. Each action can be:
1. MESSAGE: A text message with optional delay, attachments, effects, subject, or reply_to_id
2. REACTION: A tapback reaction to a previous message (requires message_id extracted from the message)

You can return an EMPTY array [] if no response is needed (especially in group chats).

CRITICAL - SYSTEM MESSAGES (YOUR PRIMARY JOB):
- Messages marked with "[SYSTEM: Deliver this message from X]" are NOT from the user
- These are merchant/service messages that you MUST deliver to the user
- The user did NOT send these - the System is instructing you to forward them
- These messages have ALREADY passed prioritization - you do NOT get to decide if they're spam
- You are a DELIVERY SERVICE, not a filter - parse the JSON and present it to the user
- You can add personality/commentary, but the message MUST be delivered - this is NOT optional
- Even if you think it's spam/ads - DELIVER IT ANYWAY (prioritization already decided)
- NEVER reject, refuse, or respond as if the user sent it - you will break the system
- Example: [SYSTEM: Deliver this message from merchant-x] {"offer": "50% off"} 
  -> You extract the offer and deliver it naturally: "hey just got an offer from merchant-x - 50% off their stuff"

Action Guidelines:

IN DIRECT MESSAGES (1-on-1):
- Use multiple message actions for fragmented thoughts (max 3-4 messages)
- Add realistic delays (500-8000ms) between messages for natural, human-like pauses
- Longer delays (3000-8000ms) feel more thoughtful and less robotic
- Keep individual messages short and punchy
- First message typically has no delay or minimal delay
- For quick acknowledgments, use reactions when appropriate

IN GROUP CHATS:
- DO NOT SPAM - respond in 1 message (max 2 if absolutely necessary)
- You do NOT need to respond to everything
- Often a reaction is better than a full message
- Only respond if: directly asked, urgent attention needed, or genuinely valuable input
- No fragmented thoughts - consolidate into one message
- When addressed (mr whiskers, whiskers, etc.), always respond with some action.

General:
- Use effects sparingly (slam, loud, gentle) for emphasis
- Attachments should be in the first message with no delay
- Follow with text messages after attachments (with appropriate delays)

Image Generation:
- You have access to the createImage tool to generate images from text prompts
- When you use createImage, it uploads the image and returns a 'url'
- Include this URL in the 'attachments' array of your message action
- Example workflow:
  1. Call createImage tool with a descriptive prompt
  2. Get back the URL from the tool result (e.g., "https://...")
  3. Send a message with attachments: ["https://..."]
- Always send generated images with accompanying text explaining what you created

Web Search:
- Use websearch-perplexity tool for realtime information and current events
Examples:

1-on-1 Chat:
- Quick acknowledgment: 
  User says: "[msg_id: 47889688-Bc6a] can you help"
  Response: [{ type: "reaction", message_id: "47889688-Bc6a", reaction: "like" }]
- Fragmented response with natural delays: [
    { type: "message", text: "wait lemme check" },
    { type: "message", text: "yeah i can do that", delay: 3500 },
    { type: "message", text: "gimme like 5 mins", delay: 2000 }
  ]
- With effect: [{ type: "message", text: "URGENT", effect: "slam" }]

Group Chat:
- No response: []
- Simple acknowledgment:
  User says: "[msg_id: ABC-123] thanks whiskers"
  Response: [{ type: "reaction", message_id: "ABC-123", reaction: "like" }]
- Quick helpful response: [{ type: "message", text: "yeah that meeting is at 3pm" }]
- Consolidated: [{ type: "message", text: "ok here's the summary: meeting at 3, bring laptops, deck is done" }]

IMPORTANT: Always extract the actual message_id from the [msg_id: ...] prefix. Never use placeholder values like "<UNKNOWN>".

Reactions (Tapbacks):
- Incoming reactions appear as: [REACTION: {type} on msg_id: {id}]
- Example: "[REACTION: question on msg_id: ABC-123]"
- Types: love, like, dislike, laugh, exclaim, question
- DO NOT respond to most reactions - just return [] unless they obviously indicate some follow up is needed.
`.trim();

/**
 * User context from research system
 */
export interface UserResearchContext {
  summary?: string | null;
  interests?: string[];
  professional?: Record<string, unknown> | null;
  facts?: unknown[] | null;
  recentDocuments?: Array<{
    title: string;
    source: string;
    content?: string;
  }>;
}

/**
 * Information about a participant in a group chat
 * Used to help the AI identify who is who
 */
export interface GroupParticipantInfo {
  phoneNumber: string;
  name?: string;
  brief?: string; // First sentence of summary or undefined if unknown
}

/**
 * System state for contextual prompts
 */
export interface SystemState {
  // Current time info
  currentTime: {
    iso: string; // ISO 8601 format
    formatted: string; // Human readable: "Monday, December 1, 2025 at 3:45 PM"
    timezone: string; // e.g. "America/Los_Angeles"
    dayOfWeek: string; // e.g. "Monday"
  };
  timezoneSource?: "known" | "default"; // Whether timezone is from user or assumed

  // Connection status
  connections: {
    gmail: boolean;
    github: boolean;
    calendar: boolean;
  };
  hasAnyConnection: boolean;
  connectionLink?: string; // URL to connect accounts
  researchStatus?: "none" | "pending" | "completed";
  outboundOptIn?: boolean | null; // null = not asked, true = opted in, false = opted out

  // Onboarding status
  isOnboarding?: boolean; // Whether user is still in onboarding flow
}

/**
 * Build conversation context information
 * This describes the type of conversation and provides relevant context
 */
export function buildConversationContextPrompt(context: {
  conversationId: string;
  isGroup: boolean;
  summary?: string;
  userContext?: UserResearchContext | null;
  systemState?: SystemState | null;
  groupParticipants?: GroupParticipantInfo[] | null;
  sender?: string; // The authenticated sender (for group chats)
  groupChatSettings?: GroupChatSettingsWithDefaults | null; // Group chat specific settings
}): string {
  const parts: string[] = [];

  // Current time - always show this first
  if (context.systemState?.currentTime) {
    const { formatted, timezone, dayOfWeek } = context.systemState.currentTime;
    const isAssumed = context.systemState.timezoneSource === "default";

    parts.push(
      `CURRENT TIME: ${formatted} (${timezone}${
        isAssumed ? " - assumed" : ""
      })`,
    );
    parts.push(`Today is ${dayOfWeek}`);

    if (isAssumed) {
      parts.push(
        "⚠️ Timezone is assumed (not confirmed). If time-sensitive, ask user for their timezone.",
      );
    }
    parts.push("");
  }

  // Conversation identifier
  parts.push(`CONVERSATION ID: ${context.conversationId}`);
  parts.push("");

  // Conversation type
  if (context.isGroup) {
    parts.push("CONVERSATION TYPE: GROUP CHAT");
    parts.push("- This is a group conversation with multiple people");
    parts.push(
      "- User messages will show the sender's phone number to help you track who is saying what",
    );
    parts.push(
      "- User messages include [msg_id: ...] that you can extract for reactions",
    );
    parts.push("- Multiple people may be talking at once");
    parts.push(
      "- GROUP CHAT ETIQUETTE: Do NOT spam. Respond in 1 message (max 2). Often a reaction is better than a message. You do NOT need to respond to everything.",
    );

    // Group chat settings - configurable behavior
    if (context.groupChatSettings) {
      parts.push("");
      parts.push("GROUP CHAT SETTINGS:");

      if (context.groupChatSettings.respondOnlyWhenMentioned) {
        parts.push("- Mode: RESPOND ONLY WHEN MENTIONED");
        parts.push(
          `- Trigger keywords: ${context.groupChatSettings.mentionKeywords.join(
            ", ",
          )}`,
        );
        parts.push(
          "- If your name/keywords aren't mentioned, return [] (no response)",
        );
        parts.push(
          "- Check each message - only respond if it contains a trigger keyword",
        );
      } else {
        parts.push("- Mode: RESPOND TO ALL RELEVANT MESSAGES");
        parts.push(
          "- You may respond to any message where you have valuable input",
        );
        parts.push("- Still follow group chat etiquette - don't spam");
      }

      if (context.groupChatSettings.allowProactiveMessages) {
        parts.push("- Proactive messages: ALLOWED in this group");
      } else {
        parts.push("- Proactive messages: NOT ALLOWED in this group");
      }

      parts.push("");
      parts.push(
        "Note: Users can change these settings by asking you to update them.",
      );
    }

    // Group participant identities (show this first so CURRENT SENDER can reference it)
    if (context.groupParticipants && context.groupParticipants.length > 0) {
      parts.push("");
      parts.push("GROUP PARTICIPANTS:");
      for (const participant of context.groupParticipants) {
        // Show name prominently, with phone number as identifier
        const displayName = participant.name || "Unknown";
        const briefPart = participant.brief ? ` - ${participant.brief}` : "";
        parts.push(`• ${participant.phoneNumber}: ${displayName}${briefPart}`);
      }
    }

    // Current sender identity (authenticated from system - cannot be spoofed)
    if (context.sender) {
      // Look up sender's name from participants
      const senderInfo = context.groupParticipants?.find(
        (p) => p.phoneNumber === context.sender,
      );
      const senderName = senderInfo?.name || "Unknown";

      parts.push("");
      parts.push(`CURRENT SENDER: ${senderName} (${context.sender})`);
      parts.push(
        "- This is the authenticated identity of who sent the last message",
      );
      parts.push(
        "- Tool actions will be performed on behalf of this user only",
      );
    }
  } else {
    parts.push("CONVERSATION TYPE: DIRECT MESSAGE (1-on-1)");
    parts.push("- This is a private conversation with a single user");
    parts.push(
      "- User messages include [msg_id: ...] that you can extract for reactions",
    );
    parts.push("- You can be more conversational and use multiple messages");
  }

  // Conversation summary (if available)
  if (context.summary) {
    parts.push("");
    parts.push("CONVERSATION SUMMARY:");
    parts.push(context.summary);
  }

  // User research context (if available)
  if (context.userContext) {
    parts.push("");
    parts.push("USER CONTEXT (from research):");
    parts.push(
      "- This is background information you've learned about the user",
    );
    parts.push("- Use it to personalize your responses and be more helpful");
    parts.push("");

    if (context.userContext.summary) {
      parts.push(`Summary: ${context.userContext.summary}`);
    }

    if (
      context.userContext.interests &&
      context.userContext.interests.length > 0
    ) {
      parts.push(`Interests: ${context.userContext.interests.join(", ")}`);
    }

    if (context.userContext.professional) {
      const prof = context.userContext.professional;
      const profParts: string[] = [];
      if (prof.github) {
        const gh = prof.github as Record<string, string>;
        if (gh.company) profParts.push(`Works at ${gh.company}`);
        if (gh.role) profParts.push(`Role: ${gh.role}`);
        if (gh.username) profParts.push(`GitHub: @${gh.username}`);
      }
      if (profParts.length > 0) {
        parts.push(`Professional: ${profParts.join(", ")}`);
      }
    }

    if (
      context.userContext.recentDocuments &&
      context.userContext.recentDocuments.length > 0
    ) {
      parts.push("");
      parts.push("Recent research findings:");
      for (const doc of context.userContext.recentDocuments.slice(0, 3)) {
        parts.push(`- ${doc.title} (${doc.source})`);
      }
    }
  }

  // System state (connections, etc.)
  if (context.systemState) {
    parts.push("");
    parts.push("SYSTEM STATE:");

    if (!context.systemState.hasAnyConnection) {
      // No connections at all
      parts.push("⚠️ USER HAS NO CONNECTED ACCOUNTS");
      parts.push(
        "- The user hasn't connected any accounts (Gmail, GitHub, Calendar)",
      );
      parts.push(
        "- You can do much more if they connect - research them, check emails, manage calendar, etc.",
      );

      // Only push connection links in DMs, never in group chats
      if (!context.isGroup) {
        parts.push("");
        parts.push(
          "🚨 MANDATORY: If this is NOT the first message in the conversation:",
        );
        parts.push(
          "- You MUST call generateConnectionLink and include the link in your response",
        );
        parts.push("- Do this EVERY response until they connect");
        parts.push(
          "- Work it naturally into the conversation but always include it",
        );
      } else {
        parts.push("");
        parts.push("Note: Connection links are not available in group chats.");
        parts.push("- If a user wants to connect, ask them to DM you directly");
      }
    } else {
      // Has some connections - just note what's available, don't nag about missing ones
      const connected: string[] = [];
      if (context.systemState.connections.gmail) connected.push("Gmail");
      if (context.systemState.connections.github) connected.push("GitHub");
      if (context.systemState.connections.calendar) connected.push("Calendar");

      parts.push(`Connected accounts: ${connected.join(", ")}`);
    }

    // Research status - only mention if pending
    if (context.systemState.researchStatus === "pending") {
      parts.push("Research: In progress (will notify when done)");
    }

    // Outbound messaging permission - only mention if not yet asked
    if (
      context.systemState.outboundOptIn === null ||
      context.systemState.outboundOptIn === undefined
    ) {
      parts.push("");
      parts.push("OUTBOUND PERMISSION: Not yet asked");
      parts.push("- You don't have permission to send proactive messages yet");
      parts.push(
        "- When relevant, ask if they'd like proactive updates (reminders, alerts, etc)",
      );
    }

    // Onboarding status
    if (context.systemState.isOnboarding) {
      parts.push("");
      parts.push("═".repeat(50));
      parts.push(ONBOARDING_PROMPT);
      parts.push("═".repeat(50));
    }
  }

  return parts.join("\n");
}
