/**
 * Gmail Integration Tool for AI Agent
 *
 * Provides Gmail access for authenticated users via AI SDK tool interface.
 * In group messages, always authenticates as the message sender.
 */

import type { ConversationContext } from "@/src/db/conversation";
import {
  getGmailMessage,
  listGmailMessages,
  searchGmailMessages,
  sendGmailMessage,
} from "@/src/lib/integrations/gmail";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { getAuthenticatedUserId } from "./helpers";

/**
 * Create Gmail tools bound to a specific conversation context
 */
export function createGmailTools(context: ConversationContext) {
  return {
    gmail_search: tool({
      description:
        "Search Gmail messages. Use this to find emails by sender, subject, or content. " +
        "Returns up to 10 matching messages with their IDs. " +
        "Only available if the user has connected their Gmail account.",
      inputSchema: zodSchema(
        z.object({
          query: z
            .string()
            .describe(
              'Gmail search query (e.g., "from:example@gmail.com subject:invoice")',
            ),
          maxResults: z
            .number()
            .optional()
            .describe("Maximum number of results to return (default: 10)"),
        }),
      ),
      execute: async ({ query, maxResults }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Gmail in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const response = await searchGmailMessages(
            userId,
            query,
            maxResults || 10,
          );

          if (!response.messages || response.messages.length === 0) {
            return {
              success: true,
              message: "No emails found matching your search query.",
              results: [],
            };
          }

          return {
            success: true,
            message: `Found ${response.messages.length} email(s)`,
            results: response.messages.map((msg) => ({
              id: msg.id,
              threadId: msg.threadId,
            })),
            resultSizeEstimate: response.resultSizeEstimate,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Gmail is not connected. The user needs to connect their Gmail account first.",
            };
          }

          return {
            success: false,
            message: `Failed to search Gmail: ${errorMessage}`,
          };
        }
      },
    }),

    gmail_get_message: tool({
      description:
        "Get the full content of a specific Gmail message by ID. " +
        "Use after gmail_search to read email details. " +
        "Only available if the user has connected their Gmail account.",
      inputSchema: zodSchema(
        z.object({
          messageId: z
            .string()
            .describe("The Gmail message ID (from gmail_search results)"),
        }),
      ),
      execute: async ({ messageId }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Gmail in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const message = await getGmailMessage(userId, messageId);

          // Parse headers for useful information
          const headers = message.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
              ?.value;

          return {
            success: true,
            message: {
              id: message.id,
              threadId: message.threadId,
              subject: getHeader("Subject"),
              from: getHeader("From"),
              to: getHeader("To"),
              date: getHeader("Date"),
              snippet: message.snippet,
              // Note: Full body parsing can be complex, snippet provides preview
            },
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Gmail is not connected. The user needs to connect their Gmail account first.",
            };
          }

          return {
            success: false,
            message: `Failed to get Gmail message: ${errorMessage}`,
          };
        }
      },
    }),

    gmail_list_recent: tool({
      description:
        "List recent Gmail messages (default: 10 most recent). " +
        "Only available if the user has connected their Gmail account.",
      inputSchema: zodSchema(
        z.object({
          maxResults: z
            .number()
            .optional()
            .describe("Maximum number of messages to list (default: 10)"),
        }),
      ),
      execute: async ({ maxResults }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Gmail in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const response = await listGmailMessages(userId, {
            maxResults: maxResults || 10,
          });

          if (!response.messages || response.messages.length === 0) {
            return {
              success: true,
              message: "No recent emails found.",
              results: [],
            };
          }

          return {
            success: true,
            message: `Found ${response.messages.length} recent email(s)`,
            results: response.messages.map((msg) => ({
              id: msg.id,
              threadId: msg.threadId,
            })),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Gmail is not connected. The user needs to connect their Gmail account first.",
            };
          }

          return {
            success: false,
            message: `Failed to list Gmail messages: ${errorMessage}`,
          };
        }
      },
    }),

    gmail_send: tool({
      description:
        "Send an email via Gmail. " +
        "Only available if the user has connected their Gmail account.",
      inputSchema: zodSchema(
        z.object({
          to: z.string().describe("Recipient email address"),
          subject: z.string().describe("Email subject line"),
          body: z.string().describe("Email body content"),
          isHtml: z
            .boolean()
            .optional()
            .describe("Whether the body is HTML (default: false)"),
        }),
      ),
      execute: async ({ to, subject, body, isHtml }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Gmail in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const message = await sendGmailMessage(userId, {
            to,
            subject,
            body,
            isHtml,
          });

          return {
            success: true,
            message: `Email sent successfully to ${to}`,
            messageId: message.id,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Gmail is not connected. The user needs to connect their Gmail account first.",
            };
          }

          return {
            success: false,
            message: `Failed to send email: ${errorMessage}`,
          };
        }
      },
    }),
  };
}
