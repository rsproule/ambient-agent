import { getConnection } from "@/src/db/connection";
import { getUserByPhoneNumber } from "@/src/db/user";
import { getContextDocuments, getUserContext } from "@/src/db/userContext";
import { queueManualResearchJob } from "@/src/lib/research/createJob";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Tool for explicitly requesting deep research on a user
 *
 * Triggers background research using connected accounts and web search.
 * User will be notified when research completes.
 * Will skip if research has already been done (unless forceRefresh is true).
 */
export const requestResearchTool = tool({
  description:
    "Request deep background research on a user. " +
    "This analyzes their connected accounts (Gmail, GitHub, Calendar) and searches the web for public info. " +
    "The user will be notified when research completes with findings. " +
    "IMPORTANT: Only use this if research hasn't been done yet. Check the system state first - " +
    "if research is already completed, you don't need to call this again.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format)"),
      forceRefresh: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "If true, runs research even if it was already done. " +
            "Only use if user explicitly asks to refresh/update research.",
        ),
      webSearchQueries: z
        .array(z.string())
        .optional()
        .describe(
          "Optional specific queries to search for. " +
            "Examples: ['John Smith software engineer', 'Acme Corp company']",
        ),
      analyzeProviders: z
        .array(z.enum(["gmail", "github", "calendar"]))
        .optional()
        .describe(
          "Which connected providers to analyze. " +
            "If not specified, analyzes all connected providers.",
        ),
    }),
  ),
  execute: async ({
    phoneNumber,
    forceRefresh,
    webSearchQueries,
    analyzeProviders,
  }) => {
    try {
      // Get user
      const user = await getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          success: false,
          message: "User not found. They need to be registered first.",
        };
      }

      // Check if research has already been done (unless forcing refresh)
      if (!forceRefresh) {
        const existingContext = await getUserContext(user.id);
        if (existingContext) {
          const docs = await getContextDocuments(user.id, { limit: 1 });
          if (docs.length > 0 || existingContext.summary) {
            return {
              success: true,
              message:
                "Research has already been done for this user. " +
                "I already know about them from previous research. " +
                "Use forceRefresh if they want me to update my knowledge.",
              alreadyResearched: true,
            };
          }
        }
      }

      // Determine which providers to analyze
      let providers: ("gmail" | "github" | "calendar")[] = [];

      if (analyzeProviders && analyzeProviders.length > 0) {
        providers = analyzeProviders;
      } else {
        // Check which providers are connected
        const [gmail, github, calendar] = await Promise.all([
          getConnection(user.id, "google_gmail").catch(() => null),
          getConnection(user.id, "github").catch(() => null),
          getConnection(user.id, "google_calendar").catch(() => null),
        ]);

        if (gmail?.status === "connected") providers.push("gmail");
        if (github?.status === "connected") providers.push("github");
        if (calendar?.status === "connected") providers.push("calendar");
      }

      if (
        providers.length === 0 &&
        (!webSearchQueries || webSearchQueries.length === 0)
      ) {
        return {
          success: false,
          message:
            "No connected accounts found and no search queries provided. " +
            "The user needs to connect at least one account (Gmail, GitHub, or Calendar) " +
            "or provide specific search queries for research.",
        };
      }

      // Queue the research job
      const { jobId } = await queueManualResearchJob({
        userId: user.id,
        providers: providers.length > 0 ? providers : undefined,
        webSearchQueries,
      });

      return {
        success: true,
        message:
          `Research job started! I'll analyze ` +
          (providers.length > 0 ? `${providers.join(", ")} ` : "") +
          (webSearchQueries && webSearchQueries.length > 0
            ? `and search for: ${webSearchQueries.join(", ")}`
            : "") +
          `. You'll be notified when I find something interesting.`,
        jobId,
        analyzingProviders: providers,
        searchQueries: webSearchQueries,
      };
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
