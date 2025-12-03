/**
 * Group Chat Settings AI Tool
 *
 * Allows users to configure group chat behavior via natural language commands.
 * The custom prompt is a freeform text that gets injected into the system prompt.
 *
 * Security: The conversationId is taken from authenticated context, not user input.
 */

import type { ConversationContext } from "@/src/db/conversation";
import {
  getGroupChatCustomPrompt,
  setGroupChatCustomPrompt,
} from "@/src/db/groupChatSettings";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound group chat settings tools
 *
 * These tools allow the AI to read and update group chat custom prompts.
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
      "Get the current custom behavior prompt for this group chat. " +
      "Returns the custom instructions that define how you behave in this group, or null if no custom behavior is set.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      try {
        const customPrompt = await getGroupChatCustomPrompt(conversationId);
        return {
          success: true,
          customPrompt,
          message: customPrompt
            ? `Current custom behavior: "${customPrompt}"`
            : "No custom behavior set for this group chat. Using default group chat etiquette.",
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
      "Update the custom behavior prompt for this group chat. " +
      "Use this when users want to change how you behave in the group. " +
      "The prompt should describe your behavior in natural language. " +
      "Examples: 'only respond when directly mentioned', 'be more active and helpful', " +
      "'focus on work topics only', 'respond in Spanish'. " +
      "Pass null or empty string to clear custom behavior and use defaults.",
    inputSchema: zodSchema(
      z.object({
        customPrompt: z
          .string()
          .nullable()
          .describe(
            "The custom behavior instructions. Use natural language to describe how you should behave. " +
              "Pass null or empty string to clear custom behavior.",
          ),
      }),
    ),
    execute: async (input: { customPrompt: string | null }) => {
      try {
        const promptToSet =
          input.customPrompt?.trim() === "" ? null : input.customPrompt?.trim();

        await setGroupChatCustomPrompt(conversationId, promptToSet ?? null);

        return {
          success: true,
          customPrompt: promptToSet,
          message: promptToSet
            ? `Updated! My new behavior: "${promptToSet}"`
            : "Cleared custom behavior. Using default group chat etiquette.",
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
