import type { ConversationContext } from "@/src/db/conversation";
import { getUserByPhoneNumber } from "@/src/db/user";
import { queueComprehensiveResearchJob } from "@/src/lib/research/createJob";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound requestResearch tool
 *
 * Triggers comprehensive background research using ALL connected accounts and web search.
 * This ALWAYS re-runs research on all providers to keep context fresh.
 * Research also runs automatically every 8 hours via the proactive scheduler.
 * User will be notified when research completes with significant findings.
 *
 * Security: Phone number is taken from authenticated context, not user input.
 */
export function createRequestResearchTool(context: ConversationContext) {
  // Get the authenticated phone number from context (system-provided, cannot be spoofed)
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Request deep comprehensive research on yourself. " +
      "This analyzes ALL your connected accounts (Gmail, GitHub, Calendar) plus web search. " +
      "Research always re-runs to keep context fresh (also runs automatically every 8 hours). " +
      "You will be notified when research completes with findings.",
    inputSchema: zodSchema(
      z.object({
        webSearchQueries: z
          .array(z.string())
          .optional()
          .describe(
            "Optional specific additional queries to search for. " +
              "Web search is automatically included, but you can add specific queries here. " +
              "Examples: ['John Smith software engineer', 'Acme Corp company']",
          ),
      }),
    ),
    execute: async ({ webSearchQueries }) => {
      try {
        if (!authenticatedPhone) {
          return {
            success: false,
            message: "Could not identify user. Please try again.",
          };
        }

        // Get user
        const user = await getUserByPhoneNumber(authenticatedPhone);
        if (!user) {
          return {
            success: false,
            message:
              "User not found. You may need to set up your account first.",
          };
        }

        // Queue comprehensive research - always re-runs all providers
        try {
          const result = await queueComprehensiveResearchJob({
            userId: user.id,
            webSearchQueries,
            triggerType: "manual",
            notify: true,
          });

          const parts: string[] = [];
          if (result.analyzingProviders.length > 0) {
            parts.push(result.analyzingProviders.join(", "));
          }
          if (result.includingWebSearch) {
            parts.push("web search");
          }

          return {
            success: true,
            message:
              `Deep research started! I'll analyze: ${parts.join(" + ")}. ` +
              `You'll be notified when I find something interesting.`,
            jobId: result.jobId,
            analyzingProviders: result.analyzingProviders,
            includingWebSearch: result.includingWebSearch,
          };
        } catch (error) {
          // If comprehensive research fails (no providers connected), provide helpful message
          if (
            error instanceof Error &&
            error.message.includes("No connected accounts")
          ) {
            return {
              success: false,
              message:
                "No connected accounts found and no search queries provided. " +
                "You need to connect at least one account (Gmail, GitHub, or Calendar) " +
                "or provide specific search queries for research.",
            };
          }
          throw error;
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to start research: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}
