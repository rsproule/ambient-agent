import { tool, zodSchema } from "ai";
import { z } from "zod";
import { generateMagicLinkUrl } from "@/src/db/magicLink";
import { env } from "@/src/lib/config/env";

/**
 * Tool for generating a magic link to manage account connections
 * 
 * Creates a one-time, time-limited link that allows the user to:
 * - Connect their Gmail account
 * - Connect their Google Calendar
 * - Connect their GitHub account
 * - Manage existing connections
 * 
 * The link expires in 1 hour and can only be used once.
 */
export const generateConnectionLinkTool = tool({
  description:
    "Generate a secure magic link for a user to manage their account connections (Gmail, Calendar, GitHub). " +
    "Use this when a user wants to connect or manage their integrations. " +
    "The link expires in 1 hour and is single-use. " +
    "Return this link in a friendly message to the user.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (the person you're chatting with)"),
    }),
  ),
  execute: async ({ phoneNumber }) => {
    try {
      // Get the base URL from environment or default to localhost
      const baseUrl =
        env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000";

      // Generate the magic link
      const magicLinkUrl = await generateMagicLinkUrl(phoneNumber, baseUrl);

      return {
        success: true,
        url: magicLinkUrl,
        expiresIn: "1 hour",
        message:
          `Here's your secure connection link: ${magicLinkUrl}\n\n` +
          `This link expires in 1 hour and can only be used once. ` +
          `Click it to manage your connected accounts (Gmail, Calendar, GitHub).`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate connection link: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

