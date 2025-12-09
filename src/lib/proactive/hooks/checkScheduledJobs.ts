/**
 * Scheduled Jobs Hook
 *
 * Finds and executes due scheduled jobs for a user
 */

import {
  getDueScheduledJobsForUser,
  markJobFailed,
  updateJobAfterRun,
  type ScheduledJob,
} from "@/src/db/scheduledJob";
import { anthropic } from "@ai-sdk/anthropic";
import { perplexity } from "@ai-sdk/perplexity";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { HookContext, HookResult } from "../types";

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
 * Execute a scheduled job and determine if results are significant
 */
async function executeScheduledJob(
  job: ScheduledJob,
  _context: HookContext, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<{
  success: boolean;
  result?: string;
  isSignificant: boolean;
  error?: string;
}> {
  try {
    // Execute the job's prompt using web search
    // Most scheduled jobs are research/news queries
    const searchResults = await simpleWebSearch(job.prompt, 5);

    if (!searchResults.success || !searchResults.results) {
      return {
        success: false,
        isSignificant: false,
        error: "Web search failed",
      };
    }

    // Summarize the results
    const resultsText = searchResults.results
      .map(
        (r: SearchResult, i: number) =>
          `[${i + 1}] ${r.title}\n${r.snippet}${
            r.url ? `\nSource: ${r.url}` : ""
          }`,
      )
      .join("\n\n");

    // Use LLM to determine if results are significant
    const analysis = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `You are analyzing search results for a scheduled job.

Job name: "${job.name}"
Job prompt: "${job.prompt}"

Search results:
${resultsText}

Previous result (for comparison):
${
  job.lastResult
    ? JSON.stringify(job.lastResult)
    : "None - this is the first run"
}

Analyze these results and determine:
1. Is there anything new/significant worth sharing with the user?
2. Create a brief, engaging summary of the most interesting findings.

If this is news/updates content, focus on what's NEW since the last check.
If results are mostly the same as before or not particularly interesting, say so.

Response format:
SIGNIFICANT: [yes/no]
SUMMARY: [Your summary if significant, or "No significant updates" if not]`,
    });

    const isSignificant = analysis.text
      .toLowerCase()
      .includes("significant: yes");
    const summaryMatch = analysis.text.match(/SUMMARY:\s*([\s\S]+)/i);
    const summary = summaryMatch
      ? summaryMatch[1].trim()
      : "Search completed but no notable findings.";

    return {
      success: true,
      result: summary,
      isSignificant,
    };
  } catch (error) {
    console.error(
      `[executeScheduledJob] Error executing job ${job.id}:`,
      error,
    );
    return {
      success: false,
      isSignificant: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check for and execute due scheduled jobs
 */
export async function checkScheduledJobs(
  context: HookContext,
): Promise<HookResult> {
  try {
    // Get due jobs for this user
    const dueJobs = await getDueScheduledJobsForUser(context.userId);

    if (dueJobs.length === 0) {
      return { shouldNotify: false };
    }

    // Process each due job
    const results: Array<{
      job: ScheduledJob;
      result: string;
      shouldNotify: boolean;
    }> = [];

    for (const job of dueJobs) {
      console.log(
        `[checkScheduledJobs] Executing job: ${job.name} (${job.id})`,
      );

      const execution = await executeScheduledJob(job, context);

      if (execution.success) {
        // Update job with results
        await updateJobAfterRun(job.id, {
          summary: execution.result,
          isSignificant: execution.isSignificant,
          executedAt: new Date().toISOString(),
        });

        // Determine if we should notify
        const shouldNotify =
          job.notifyMode === "always" ||
          (job.notifyMode === "significant" && execution.isSignificant);

        if (shouldNotify && execution.result) {
          results.push({
            job,
            result: execution.result,
            shouldNotify: true,
          });
        }
      } else {
        // Mark job as failed (but don't disable it)
        await markJobFailed(job.id, false);
        console.error(
          `[checkScheduledJobs] Job ${job.id} failed: ${execution.error}`,
        );
      }
    }

    // If no results to notify, we're done
    if (results.length === 0) {
      return { shouldNotify: false };
    }

    // Build notification message for the first result
    // (future: could batch multiple results)
    const firstResult = results[0];
    const signature = `scheduled:${firstResult.job.id}:${Date.now()}`;

    const message =
      `[SYSTEM: Scheduled job result - share with user in a friendly way]\n` +
      `[${signature}]\n` +
      `Scheduled job "${firstResult.job.name}" has completed.\n` +
      `Results: ${firstResult.result}`;

    return {
      shouldNotify: true,
      message,
      contentSignature: signature,
      metadata: {
        jobId: firstResult.job.id,
        jobName: firstResult.job.name,
        totalJobsRun: dueJobs.length,
        totalWithResults: results.length,
      },
    };
  } catch (error) {
    console.error("[checkScheduledJobs] Error checking scheduled jobs:", error);
    return { shouldNotify: false };
  }
}
