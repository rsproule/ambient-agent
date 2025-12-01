/**
 * Run Scheduled Job Task
 *
 * Executes a single scheduled job (fuzzy job) and optionally notifies the user.
 */

import { getScheduledJob, markJobFailed, updateJobAfterRun } from "@/src/db/scheduledJob";
import { getPhoneNumberForUser } from "@/src/db/user";
import { saveSystemMessage } from "@/src/db/conversation";
import { perplexity } from "@ai-sdk/perplexity";
import { task } from "@trigger.dev/sdk/v3";
import { generateObject, generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { debouncedResponse } from "./debouncedResponse";

type RunScheduledJobPayload = {
  jobId: string;
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Simple web search using Perplexity
 */
async function simpleWebSearch(
  query: string,
  maxResults: number = 5,
): Promise<{ success: boolean; results?: SearchResult[] }> {
  try {
    const { object } = await generateObject({
      model: perplexity("sonar"),
      schema: z.object({
        results: z.array(
          z.object({
            title: z.string(),
            url: z.string(),
            snippet: z.string(),
          }),
        ),
      }),
      system:
        "You are a search assistant. Return strictly the JSON schema provided. For each result include title, url, and a short snippet.",
      prompt: `Search the web for: ${query}. Return up to ${maxResults} high-quality, diverse results with proper URLs.`,
    });

    return {
      success: true,
      results: object.results.slice(0, maxResults),
    };
  } catch (error) {
    console.error("[simpleWebSearch] Error:", error);
    return { success: false };
  }
}

/**
 * Execute a scheduled job and notify user if appropriate
 */
export const runScheduledJob = task({
  id: "run-scheduled-job",
  machine: {
    preset: "small-1x",
  },
  run: async (payload: RunScheduledJobPayload) => {
    const { jobId } = payload;

    console.log(`[RunScheduledJob] Starting job ${jobId}`);

    // Get the job
    const job = await getScheduledJob(jobId);
    if (!job) {
      console.error(`[RunScheduledJob] Job not found: ${jobId}`);
      return { success: false, reason: "job_not_found" };
    }

    if (!job.enabled) {
      console.log(`[RunScheduledJob] Job is disabled: ${jobId}`);
      return { success: false, reason: "job_disabled" };
    }

    // Get user's phone number
    const phoneNumber = await getPhoneNumberForUser(job.userId);
    if (!phoneNumber) {
      console.error(`[RunScheduledJob] No phone number for user: ${job.userId}`);
      await markJobFailed(jobId, false);
      return { success: false, reason: "no_phone_number" };
    }

    try {
      // Execute the job's prompt using web search
      console.log(`[RunScheduledJob] Executing web search for: ${job.prompt}`);
      const searchResults = await simpleWebSearch(job.prompt, 5);

      if (!searchResults.success || !searchResults.results) {
        console.error(`[RunScheduledJob] Web search failed for job ${jobId}`);
        await markJobFailed(jobId, false);
        return { success: false, reason: "search_failed" };
      }

      // Format search results
      const resultsText = searchResults.results
        .map(
          (r: SearchResult, i: number) =>
            `[${i + 1}] ${r.title}\n${r.snippet}${r.url ? `\nSource: ${r.url}` : ""}`,
        )
        .join("\n\n");

      // Use LLM to analyze results and determine significance
      const analysis = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `You are analyzing search results for a scheduled job.

Job name: "${job.name}"
Job prompt: "${job.prompt}"

Search results:
${resultsText}

Previous result (for comparison):
${job.lastResult ? JSON.stringify(job.lastResult) : "None - this is the first run"}

Analyze these results and determine:
1. Is there anything new/significant worth sharing with the user?
2. Create a brief, engaging summary of the most interesting findings.

If this is news/updates content, focus on what's NEW since the last check.
If results are mostly the same as before or not particularly interesting, say so.

Response format:
SIGNIFICANT: [yes/no]
SUMMARY: [Your summary if significant, or "No significant updates" if not]`,
      });

      const isSignificant = analysis.text.toLowerCase().includes("significant: yes");
      const summaryMatch = analysis.text.match(/SUMMARY:\s*([\s\S]+)/i);
      const summary = summaryMatch
        ? summaryMatch[1].trim()
        : "Search completed but no notable findings.";

      // Update job with results
      await updateJobAfterRun(jobId, {
        summary,
        isSignificant,
        executedAt: new Date().toISOString(),
        searchResults: searchResults.results.slice(0, 3).map((r: SearchResult) => ({
          title: r.title,
          snippet: r.snippet,
          url: r.url,
        })),
      });

      // Determine if we should notify the user
      const shouldNotify =
        job.notifyMode === "always" ||
        (job.notifyMode === "significant" && isSignificant);

      if (!shouldNotify) {
        console.log(
          `[RunScheduledJob] Job ${jobId} completed, but not notifying (notifyMode: ${job.notifyMode}, isSignificant: ${isSignificant})`,
        );
        return {
          success: true,
          notified: false,
          reason: "not_significant",
          summary,
        };
      }

      // Build notification message
      const systemMessage =
        `[SYSTEM: Scheduled job "${job.name}" completed - share findings naturally]\n` +
        `[scheduled:${jobId}:${Date.now()}]\n` +
        `\n${summary}\n\n` +
        `Sources:\n${searchResults.results
          .slice(0, 3)
          .map((r: SearchResult) => `- ${r.title}${r.url ? ` (${r.url})` : ""}`)
          .join("\n")}`;

      // Save system message
      await saveSystemMessage(
        phoneNumber,
        systemMessage,
        `scheduled-job:${job.name}`,
        false,
      );

      // Trigger Whiskers to respond
      await debouncedResponse.trigger({
        conversationId: phoneNumber,
        recipient: phoneNumber,
        timestampWhenTriggered: new Date().toISOString(),
      });

      console.log(`[RunScheduledJob] Job ${jobId} completed and user notified`);

      return {
        success: true,
        notified: true,
        summary,
        isSignificant,
      };
    } catch (error) {
      console.error(`[RunScheduledJob] Error executing job ${jobId}:`, error);
      await markJobFailed(jobId, false);
      return {
        success: false,
        reason: "execution_error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

