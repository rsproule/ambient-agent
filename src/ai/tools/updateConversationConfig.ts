import { upsertPrioritizationConfig } from "@/src/db/prioritization";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Tool for updating conversation prioritization config
 *
 * Allows the agent to update the minimum notify price and custom value prompt
 * for the current conversation directly from chat.
 */
export const updateConversationConfigTool = tool({
  description:
    "Update the prioritization configuration for the current conversation. " +
    "This controls which incoming messages will be delivered based on their value. " +
    "DEFAULT: minimumNotifyPrice=$0 (all messages delivered), isEnabled=true. " +
    "Users can set a minimum dollar threshold and optionally customize how message value is calculated.",
  inputSchema: zodSchema(
    z.object({
      conversationId: z
        .string()
        .describe("The conversation ID (phone number or group_id)"),
      minimumNotifyPrice: z
        .number()
        .min(-100)
        .max(10000)
        .describe(
          "Minimum dollar value for a message to be delivered. " +
            "DEFAULT: 0 (all messages). Examples: 5 = only $5+ messages, -10 = block messages worth less than -$10. " +
            "Recommended ranges: 0-10 for casual filtering, 10-50 for important only, 50+ for critical only.",
        ),
      customValuePrompt: z
        .string()
        .optional()
        .describe(
          "Optional custom instructions for how to evaluate message value. " +
            "This will be appended to the default AI evaluation prompt. " +
            "Use this to specify what types of messages the user finds valuable.",
        ),
      isEnabled: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Enable or disable prioritization for this conversation. " +
            "DEFAULT: true. Set to false to disable filtering temporarily.",
        ),
    }),
  ),
  execute: async ({
    conversationId,
    minimumNotifyPrice,
    customValuePrompt,
    isEnabled,
  }) => {
    try {
      const config = await upsertPrioritizationConfig(conversationId, {
        minimumNotifyPrice,
        customValuePrompt,
        isEnabled,
      });

      return {
        success: true,
        message: `Updated prioritization config for this conversation. Minimum notify price: $${
          config.minimumNotifyPrice
        }. ${
          config.customValuePrompt
            ? "Using custom value prompt."
            : "Using default value prompt."
        } Prioritization is ${config.isEnabled ? "enabled" : "disabled"}.`,
        config: {
          minimumNotifyPrice: config.minimumNotifyPrice,
          customValuePrompt: config.customValuePrompt,
          isEnabled: config.isEnabled,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update config: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});
