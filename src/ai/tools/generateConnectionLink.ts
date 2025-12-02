import type { ConversationContext } from "@/src/db/conversation";
import { generateMagicLinkUrl } from "@/src/db/magicLink";
import { env } from "@/src/lib/config/env";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound generateConnectionLink tool
 *
 * Creates a one-time, time-limited link that allows the user to:
 * - Connect their Gmail account
 * - Connect their Google Calendar
 * - Connect their GitHub account
 * - Manage existing connections
 *
 * The link expires in 1 hour and can only be used once.
 *
 * Security: Phone number is taken from authenticated context, not user input.
 */
export function createGenerateConnectionLinkTool(context: ConversationContext) {
  // Get the authenticated phone number from context (system-provided, cannot be spoofed)
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Generate a secure magic link for you to manage your account connections (Gmail, Calendar, GitHub). " +
      "Use this when you want to connect or manage your integrations. " +
      "The link expires in 1 hour and is single-use. " +
      "The link will be returned in a friendly message.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      try {
        if (!authenticatedPhone) {
          return {
            success: false,
            message: "Could not identify user. Please try again.",
          };
        }

        // Get the base URL from environment or default to localhost
        const baseUrl = env.NEXT_PUBLIC_BASE_URL || "https://mrwhiskers.chat";

        // Generate the magic link
        const magicLinkUrl = await generateMagicLinkUrl(
          authenticatedPhone,
          baseUrl,
        );

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
          message: `Failed to generate connection link: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}
