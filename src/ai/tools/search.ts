import { xai } from "@ai-sdk/xai";
import { generateText, tool, zodSchema, type Tool } from "ai";
import { z } from "zod";

export const grokSearchTool = tool({
  description:
    "Search the web and X/Twitter for real-time information. " +
    "Use this for: current events, breaking news, trending topics, " +
    "public reactions, social commentary, technical documentation, " +
    "articles, public figure statements, and any information that " +
    "requires up-to-date sources. Grok will intelligently search " +
    "both web and X to find the best information.",
  inputSchema: zodSchema(
    z.object({
      query: z
        .string()
        .min(1)
        .describe("Search query. Be specific about what you're looking for."),
      allowedXHandles: z
        .array(z.string())
        .max(10)
        .optional()
        .describe(
          "Only search X posts from these handles (without @ symbol). Max 10.",
        ),
      excludedXHandles: z
        .array(z.string())
        .max(10)
        .optional()
        .describe(
          "Exclude X posts from these handles (without @ symbol). Max 10.",
        ),
      fromDate: z
        .string()
        .optional()
        .describe("Only include posts from this date (YYYY-MM-DD format)"),
      toDate: z
        .string()
        .optional()
        .describe("Only include posts up to this date (YYYY-MM-DD format)"),
    }),
  ),
  execute: async ({
    query,
    allowedXHandles,
    excludedXHandles,
    fromDate,
    toDate,
  }) => {
    try {
      // Build X search options only if filters are provided
      const xSearchOptions: {
        allowedXHandles?: string[];
        excludedXHandles?: string[];
        fromDate?: string;
        toDate?: string;
      } = {};

      if (allowedXHandles?.length) {
        xSearchOptions.allowedXHandles = allowedXHandles.map((h) =>
          h.replace(/^@/, ""),
        );
      }
      if (excludedXHandles?.length) {
        xSearchOptions.excludedXHandles = excludedXHandles.map((h) =>
          h.replace(/^@/, ""),
        );
      }
      if (fromDate) {
        xSearchOptions.fromDate = fromDate;
      }
      if (toDate) {
        xSearchOptions.toDate = toDate;
      }

      const { text, sources } = await generateText({
        model: xai.responses("grok-4-fast"),
        prompt: query,
        tools: {
          web_search: xai.tools.webSearch() as Tool,
          x_search: xai.tools.xSearch(xSearchOptions) as Tool,
        },
        providerOptions: {
          xai: {
            reasoningEffort: "high",
          },
        },
      });

      return {
        success: true,
        content: text,
        sources: sources ?? [],
        message: sources?.length
          ? `Found information from ${sources.length} sources`
          : "Search completed",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        message: `Search failed: ${errorMessage}`,
      };
    }
  },
});
