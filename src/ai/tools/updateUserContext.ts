import { updateUserContext as updateUserContextDb } from "@/src/db/user";
import { tool } from "ai";
import { z } from "zod";

/**
 * Tool for updating user context and preferences
 *
 * Allows the agent to store information about a user including:
 * - User preferences and settings
 * - Custom context the user has shared
 * - Any other metadata that should be remembered
 */
export const updateUserContextTool = tool({
  description:
    "Update or store context and preferences for a specific user by their phone number. " +
    "Use this to save information the user shares about themselves, their preferences, " +
    "or any custom settings they want to configure. By default, this merges with existing " +
    "data. Set replace=true to completely overwrite existing context.",
  inputSchema: z.object({
    phoneNumber: z
      .string()
      .describe("The user's phone number (E.164 format or email)"),
    context: z
      .object({})
      .passthrough()
      .describe(
        "The context data to store as a JSON object. Can include any properties like " +
          "preferences, notes, custom fields, etc. Examples: {name: 'John', timezone: 'America/New_York', " +
          "preferences: {notificationStyle: 'minimal'}}",
      ),
    replace: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "If true, completely replaces existing context. If false (default), merges with existing context.",
      ),
  }),
  execute: async ({ phoneNumber, context, replace }) => {
    try {
      const user = await updateUserContextDb(phoneNumber, context, replace);

      return {
        success: true,
        message:
          `User context ${
            replace ? "replaced" : "updated"
          } successfully for ${phoneNumber}. ` +
          `Stored ${Object.keys(context).length} properties.`,
        updatedContext: user.metadata,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update user context: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});
