import {
  getResearchJob,
  updateResearchJobStatus,
  type ResearchTask,
} from "@/src/db/researchJob";
import { getUserContext, updateUserContext } from "@/src/db/userContext";
import {
  analyzeProvider,
  runWebSearch,
  storeFact,
} from "@/src/lib/research/tasks";
import { task } from "@trigger.dev/sdk/v3";
import { notifyUserOfResearch } from "./notifyUserOfResearch";

type RunResearchJobPayload = {
  jobId: string;
};

/**
 * Main research job runner
 * Executes research tasks and optionally notifies the user
 */
export const runResearchJob = task({
  id: "run-research-job",
  machine: {
    preset: "medium-1x", // 1 vCPU, 2 GB RAM for AI operations
  },
  run: async (payload: RunResearchJobPayload) => {
    const { jobId } = payload;

    // Get the job
    const job = await getResearchJob(jobId);
    if (!job) {
      throw new Error(`Research job not found: ${jobId}`);
    }

    // Mark as running
    await updateResearchJobStatus(jobId, "running");

    console.log(
      `[ResearchJob] Starting job ${jobId} for ${job.targetType}:${job.targetId}`,
      { triggerType: job.triggerType, taskCount: job.tasks.length },
    );

    const results: Array<{
      task: ResearchTask;
      success: boolean;
      result?: unknown;
      error?: string;
    }> = [];

    let hasSignificantFindings = false;

    try {
      // Execute each research task
      for (const researchTask of job.tasks) {
        console.log(`[ResearchJob] Executing task: ${researchTask.type}`);

        try {
          const result = await executeTask(job.targetId, researchTask);
          results.push({ task: researchTask, success: true, result });

          // Check if this task had significant findings
          if (
            result &&
            typeof result === "object" &&
            "documentsCreated" in result
          ) {
            if ((result as { documentsCreated: number }).documentsCreated > 0) {
              hasSignificantFindings = true;
            }
          }
        } catch (error) {
          console.error(`[ResearchJob] Task failed:`, error);
          results.push({
            task: researchTask,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Generate summary of findings
      const summary = await generateResearchSummary(job.targetId);

      // Update user context with summary
      if (summary) {
        await updateUserContext(job.targetId, { summary });
      }

      // Mark job as completed
      await updateResearchJobStatus(jobId, "completed", {
        result: {
          taskResults: results,
          summary,
          hasSignificantFindings,
        },
      });

      // Post-processing: notify if configured
      if (job.postProcess?.notify) {
        const shouldNotify =
          !job.postProcess.notifyOnlyIfSignificant || hasSignificantFindings;

        if (shouldNotify) {
          console.log(`[ResearchJob] Triggering notification for user`);
          await notifyUserOfResearch.trigger({
            userId: job.targetId,
            jobId,
            summary: summary || "Research completed",
            triggerType: job.triggerType,
          });
        }
      }

      return {
        success: true,
        jobId,
        taskResults: results,
        summary,
        notified: job.postProcess?.notify && hasSignificantFindings,
      };
    } catch (error) {
      // Mark job as failed
      await updateResearchJobStatus(jobId, "failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

/**
 * Execute a single research task
 */
async function executeTask(
  userId: string,
  task: ResearchTask,
): Promise<unknown> {
  switch (task.type) {
    case "analyze_provider":
      return analyzeProvider(userId, task.provider);

    case "web_search":
      return runWebSearch(userId, task.queries);

    case "store_fact":
      return storeFact(userId, task.content, task.invalidates);

    default:
      throw new Error(`Unknown task type: ${(task as { type: string }).type}`);
  }
}

/**
 * Generate a summary of the user's context
 */
async function generateResearchSummary(userId: string): Promise<string | null> {
  const context = await getUserContext(userId);
  if (!context) return null;

  const parts: string[] = [];

  // Add professional info
  if (context.professional) {
    const prof = context.professional as Record<string, unknown>;
    if (prof.github) {
      const gh = prof.github as Record<string, string>;
      parts.push(
        `Works at ${gh.company || "unknown company"} as ${
          gh.role || "a developer"
        }`,
      );
    }
  }

  // Add interests
  if (context.interests && context.interests.length > 0) {
    parts.push(`Interested in: ${context.interests.slice(0, 5).join(", ")}`);
  }

  // Add facts count
  if (context.facts && Array.isArray(context.facts)) {
    parts.push(`${context.facts.length} known facts`);
  }

  return parts.length > 0 ? parts.join(". ") : null;
}
