import { getUserByPhoneNumber } from "@/src/db/user";
import { findSimilarDocuments, getContextDocuments } from "@/src/db/userContext";
import { generateEmbedding } from "@/src/lib/embeddings";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Tool for searching user's research documents
 *
 * NOTE: Basic user context (summary, interests, professional info) is already
 * provided in the conversation context by default. Only use this tool when you
 * need to search for specific information in their documents via semantic search.
 */
export const getUserContextTool = tool({
  description:
    "Search through a user's research documents using semantic search. " +
    "ONLY use this when you need specific information NOT already in the conversation context. " +
    "The user's summary, interests, and professional info are already provided by default - " +
    "this tool is for deeper queries like 'find emails about project X' or 'what repos are they working on'.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format or email)"),
      query: z
        .string()
        .optional()
        .describe(
          "Search query to find relevant documents. If not provided, returns most recent documents.",
        ),
    }),
  ),
  execute: async ({ phoneNumber, query }) => {
    try {
      const user = await getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          success: false,
          message: `User not found for phone number: ${phoneNumber}`,
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
            : "No research documents available for this user.",
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
