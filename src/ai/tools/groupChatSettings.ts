/**
 * Group Chat Settings AI Tool
 *
 * Allows users to configure group chat behavior via natural language commands.
 * The AI can update settings like:
 * - Whether to respond only when mentioned
 * - Custom mention keywords
 * - Whether proactive messages are allowed
 *
 * Security: The conversationId is taken from authenticated context, not user input.
 */

import type { ConversationContext } from "@/src/db/conversation";
import {
  DEFAULT_MENTION_KEYWORDS,
  getGroupChatSettings,
  upsertGroupChatSettings,
} from "@/src/db/groupChatSettings";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound group chat settings tools
 *
 * These tools allow the AI to read and update group chat settings.
 * Only available in group chat contexts.
 */
export function createGroupChatSettingsTools(context: ConversationContext) {
  // These tools are only useful in group chats
  if (!context.isGroup) {
    return {};
  }

  const conversationId = context.conversationId;

  const getGroupChatSettingsTool = tool({
    description:
      "Get the current group chat settings for this conversation. " +
      "Shows whether you respond only when mentioned, what keywords trigger a response, " +
      "and whether proactive messages are allowed.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      try {
        const settings = await getGroupChatSettings(conversationId);
        return {
          success: true,
          settings: {
            respondOnlyWhenMentioned: settings.respondOnlyWhenMentioned,
            mentionKeywords: settings.mentionKeywords,
            allowProactiveMessages: settings.allowProactiveMessages,
          },
          explanation: settings.respondOnlyWhenMentioned
            ? `I only respond when mentioned with: ${settings.mentionKeywords.join(", ")}`
            : "I respond to all relevant messages in this group",
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to get settings: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });

  const updateGroupChatSettingsTool = tool({
    description:
      "Update the group chat settings. " +
      "Use this when users want to change how you behave in the group chat. " +
      "Examples: 'only respond when I mention you', 'respond to everything', " +
      "'add [keyword] as a trigger', 'allow proactive messages'",
    inputSchema: zodSchema(
      z.object({
        respondOnlyWhenMentioned: z
          .boolean()
          .optional()
          .describe(
            "If true, only respond when mentioned by name/keyword. " +
              "If false, respond to all relevant messages.",
          ),
        mentionKeywords: z
          .array(z.string())
          .optional()
          .describe(
            "Custom keywords that trigger a response (e.g., ['whiskers', 'mr whiskers', '@ai']). " +
              "These are case-insensitive. Leave undefined to keep current keywords.",
          ),
        allowProactiveMessages: z
          .boolean()
          .optional()
          .describe(
            "If true, allow sending proactive messages to this group. " +
              "If false, only respond to direct messages.",
          ),
      }),
    ),
    execute: async (input: {
      respondOnlyWhenMentioned?: boolean;
      mentionKeywords?: string[];
      allowProactiveMessages?: boolean;
    }) => {
      try {
        // Validate mention keywords if provided
        let cleanedKeywords = input.mentionKeywords;
        if (cleanedKeywords !== undefined) {
          if (cleanedKeywords.length === 0) {
            return {
              success: false,
              message:
                "You need at least one trigger keyword. " +
                `Default keywords are: ${DEFAULT_MENTION_KEYWORDS.join(", ")}`,
            };
          }
          // Clean up keywords - trim and lowercase
          cleanedKeywords = cleanedKeywords.map((k: string) =>
            k.trim().toLowerCase(),
          );
        }

        await upsertGroupChatSettings(conversationId, {
          respondOnlyWhenMentioned: input.respondOnlyWhenMentioned,
          mentionKeywords: cleanedKeywords,
          allowProactiveMessages: input.allowProactiveMessages,
        });

        // Fetch the updated settings to confirm
        const updated = await getGroupChatSettings(conversationId);

        const changes: string[] = [];
        if (input.respondOnlyWhenMentioned !== undefined) {
          changes.push(
            input.respondOnlyWhenMentioned
              ? "now only responding when mentioned"
              : "now responding to all relevant messages",
          );
        }
        if (input.mentionKeywords !== undefined) {
          changes.push(
            `trigger keywords set to: ${updated.mentionKeywords.join(", ")}`,
          );
        }
        if (input.allowProactiveMessages !== undefined) {
          changes.push(
            input.allowProactiveMessages
              ? "proactive messages enabled"
              : "proactive messages disabled",
          );
        }

        return {
          success: true,
          settings: {
            respondOnlyWhenMentioned: updated.respondOnlyWhenMentioned,
            mentionKeywords: updated.mentionKeywords,
            allowProactiveMessages: updated.allowProactiveMessages,
          },
          changes: changes.length > 0 ? changes.join(", ") : "no changes made",
          message: `Settings updated! ${changes.join(". ")}.`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to update settings: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });

  return {
    getGroupChatSettings: getGroupChatSettingsTool,
    updateGroupChatSettings: updateGroupChatSettingsTool,
  };
}

