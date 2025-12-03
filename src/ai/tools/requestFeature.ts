/**
 * Feature Request Tool for AI Agent
 *
 * Allows Whiskers to record feature requests from users.
 * When a user asks for something Whiskers can't do, this tool
 * captures the request for future development.
 *
 * Security: Phone number is taken from authenticated context, not user input.
 */

import type { ConversationContext } from "@/src/db/conversation";
import { createFeatureRequest } from "@/src/db/featureRequest";
import { getUserByPhoneNumber } from "@/src/db/user";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound requestFeature tool
 */
export function createRequestFeatureTool(context: ConversationContext) {
  // Get the authenticated phone number from context (system-provided, cannot be spoofed)
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Record a feature request from the user. Use this when a user asks for something " +
      "you cannot do yet, or explicitly requests a new feature. This helps the team " +
      "prioritize what to build next. Always acknowledge the request to the user.",
    inputSchema: zodSchema(
      z.object({
        description: z
          .string()
          .describe(
            "Clear description of the requested feature. Be specific about what the user wants.",
          ),
        context: z
          .string()
          .optional()
          .describe(
            "Optional context about why they need this or how they described it.",
          ),
      }),
    ),
    execute: async ({ description, context: requestContext }) => {
      try {
        // Get user name if available
        let userName: string | undefined;
        if (authenticatedPhone) {
          const user = await getUserByPhoneNumber(authenticatedPhone);
          userName = user?.name ?? undefined;
        }

        const request = await createFeatureRequest({
          description,
          phoneNumber: authenticatedPhone,
          userName,
          context: requestContext,
        });

        return {
          success: true,
          message: "Feature request recorded! The team will review it.",
          requestId: request.id,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to record feature request: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}

