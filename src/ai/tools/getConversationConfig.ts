import { getPrioritizationConfig } from "@/src/db/prioritization";
import { DEFAULT_CONFIG } from "@/src/services/prioritization";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Tool for fetching current conversation prioritization config
 *
 * Allows the agent to check current settings for the conversation
 * so they can summarize them for the user.
 */
export const getConversationConfigTool = tool({
  description:
    "Get the current prioritization configuration for the conversation. " +
    "Use this when users ask about their current settings, notification thresholds, or filtering preferences. " +
    "Returns minimumNotifyPrice, customValuePrompt, and isEnabled status.",
  inputSchema: zodSchema(
    z.object({
      conversationId: z
        .string()
        .describe("The conversation ID (phone number or group_id)"),
    }),
  ),
  execute: async ({ conversationId }) => {
    try {
      const config = await getPrioritizationConfig(conversationId);

      // If no config exists, return defaults
      if (!config) {
        return {
          success: true,
          config: {
            conversationId,
            minimumNotifyPrice: DEFAULT_CONFIG.minimumNotifyPrice,
            customValuePrompt: DEFAULT_CONFIG.customValuePrompt,
            isEnabled: DEFAULT_CONFIG.isEnabled,
          },
          isDefault: true,
          message:
            "No custom configuration set. Using default settings: All messages delivered ($0 threshold), prioritization enabled.",
        };
      }

      return {
        success: true,
        config: {
          conversationId: config.conversationId,
          minimumNotifyPrice: config.minimumNotifyPrice,
          customValuePrompt: config.customValuePrompt,
          isEnabled: config.isEnabled,
        },
        isDefault: false,
        message: `Custom configuration active: $${
          config.minimumNotifyPrice
        } minimum threshold, ${
          config.customValuePrompt
            ? "custom value prompt set"
            : "using default value prompt"
        }, prioritization ${config.isEnabled ? "enabled" : "disabled"}.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get config: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});
