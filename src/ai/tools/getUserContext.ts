import type { ConversationContext } from "@/src/db/conversation";
import { getUserByPhoneNumber } from "@/src/db/user";
import { findSimilarDocuments, getContextDocuments } from "@/src/db/userContext";
import { generateEmbedding } from "@/src/lib/embeddings";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound getUserContext tool
 *
 * NOTE: Basic user context (summary, interests, professional info) is already
 * provided in the conversation context by default. Only use this tool when you
 * need to search for specific information in their documents via semantic search.
 *
 * Security: Phone number is taken from authenticated context, not user input.
 */
export function createGetUserContextTool(context: ConversationContext) {
  // Get the authenticated phone number from context (system-provided, cannot be spoofed)
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Search through your research documents using semantic search. " +
      "ONLY use this when you need specific information NOT already in the conversation context. " +
      "Your summary, interests, and professional info are already provided by default - " +
      "this tool is for deeper queries like 'find emails about project X' or 'what repos are you working on'.",
    inputSchema: zodSchema(
      z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Search query to find relevant documents. If not provided, returns most recent documents.",
          ),
      }),
    ),
    execute: async ({ query }) => {
      try {
        if (!authenticatedPhone) {
          return {
            success: false,
            message: "Could not identify user. Please try again.",
          };
        }

        const user = await getUserByPhoneNumber(authenticatedPhone);
        if (!user) {
          return {
            success: false,
            message: "User not found. You may need to set up your account first.",
          };
        }

        let documents: Array<{
          title: string;
          source: string;
          content: string;
          similarity?: number;
        }> = [];

        if (query) {
          // Semantic search
          const embedding = await generateEmbedding(query);
          const results = await findSimilarDocuments(user.id, embedding, {
            limit: 5,
            threshold: 0.6,
          });
          documents = results.map((d) => ({
            title: d.title,
            source: d.source,
            content: d.content,
            similarity: d.similarity,
          }));
        } else {
          // Most recent documents
          const results = await getContextDocuments(user.id, { limit: 5 });
          documents = results.map((d) => ({
            title: d.title,
            source: d.source,
            content: d.content,
          }));
        }

        if (documents.length === 0) {
          return {
            success: true,
            documents: [],
            message: query
              ? `No documents found matching "${query}"`
              : "No research documents available.",
          };
        }

        return {
          success: true,
          documents,
          message: `Found ${documents.length} relevant documents${query ? ` for "${query}"` : ""}`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to search user documents: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}
