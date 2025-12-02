/**
 * Deep Research Proactive Hook
 *
 * Runs comprehensive research on a user every 8 hours (by default).
 * This analyzes all connected OAuth providers (Gmail, GitHub, Calendar)
 * and runs web search to keep user context fresh and up-to-date.
 */

import { queueComprehensiveResearchJob } from "@/src/lib/research/createJob";
import type { HookContext, HookResult } from "../types";

/**
 * Check and trigger deep research for a user
 *
 * This hook:
 * 1. Queues comprehensive research on ALL connected providers
 * 2. Runs web search for public information
 * 3. Updates user context with fresh findings
 *
 * Unlike other hooks, this doesn't directly notify the user.
 * Instead, the research job handles notifications based on findings.
 */
export async function checkDeepResearch(
  context: HookContext,
): Promise<HookResult> {
  try {
    console.log(`[checkDeepResearch] Starting for user ${context.userId}`);

    // Check if user has any connected providers
    const hasConnections =
      context.connections.gmail ||
      context.connections.github ||
      context.connections.calendar;

    if (!hasConnections) {
      console.log(
        `[checkDeepResearch] User ${context.userId} has no connected accounts, skipping`,
      );
      return {
        shouldNotify: false,
        metadata: { reason: "no_connections" },
      };
    }

    // Queue comprehensive research job
    const result = await queueComprehensiveResearchJob({
      userId: context.userId,
      triggerType: "scheduled",
      notify: false, // Research job handles its own notifications
    });

    console.log(
      `[checkDeepResearch] Queued research job ${result.jobId} for user ${context.userId}`,
      {
        analyzingProviders: result.analyzingProviders,
        includingWebSearch: result.includingWebSearch,
      },
    );

    // Don't notify here - the research job will notify if it finds something significant
    return {
      shouldNotify: false,
      metadata: {
        jobId: result.jobId,
        analyzingProviders: result.analyzingProviders,
        includingWebSearch: result.includingWebSearch,
      },
    };
  } catch (error) {
    console.error(`[checkDeepResearch] Error for user ${context.userId}:`, error);

    // Don't fail the whole proactive check, just log the error
    return {
      shouldNotify: false,
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

