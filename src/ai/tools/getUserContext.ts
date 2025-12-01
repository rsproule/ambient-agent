import { getUserContext as getUserContextDb } from "@/src/db/user";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Tool for fetching user context and preferences
 *
 * Allows the agent to read stored information about a user including:
 * - User preferences and settings
 * - Custom context the user has shared
 * - Any other metadata stored for this user
 */
export const getUserContextTool = tool({
  description:
    "Get the stored context and preferences for a specific user by their phone number. " +
    "Use this to retrieve information the user has shared about themselves, their preferences, " +
    "or any custom settings they've configured. Returns the user's metadata as a JSON object.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format or email)"),
    }),
  ),
  execute: async ({ phoneNumber }) => {
    try {
      const context = await getUserContextDb(phoneNumber);

      if (!context || Object.keys(context).length === 0) {
        return {
          success: true,
          context: {},
          message:
            "No user context found. This user hasn't stored any preferences or information yet.",
        };
      }

      return {
        success: true,
        context,
        message: `User context retrieved successfully. Contains ${
          Object.keys(context).length
        } properties.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get user context: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});
