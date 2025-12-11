/**
 * Scheduled Jobs Hook
 *
 * Finds due scheduled jobs and triggers the runScheduledJob task for each.
 * The task handles running the prompt through the agent (which decides what to do).
 */

import prisma from "@/src/db/client";
import {
  calculateNextRun,
  getDueScheduledJobsForUser,
} from "@/src/db/scheduledJob";
import { runScheduledJob } from "@/src/trigger/tasks/runScheduledJob";
import type { HookContext, HookResult } from "../types";

/**
 * Check for due scheduled jobs and trigger them
 *
 * This hook just finds due jobs and triggers the runScheduledJob task.
 * The task handles everything: running the prompt through the agent,
 * letting the agent decide what tools to use, and sending the response.
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

    // Trigger the runScheduledJob task for each due job
    // The task handles running the prompt through the agent and sending the response
    for (const job of dueJobs) {
      console.log(
        `[checkScheduledJobs] Triggering job: ${job.name} (${job.id})`,
      );

      // Update nextRunAt immediately to prevent duplicate triggers
      // (in case proactive check runs again before task completes)
      const nextRunAt = calculateNextRun(job.cronSchedule, job.timezone);
      await prisma.scheduledJob.update({
        where: { id: job.id },
        data: { nextRunAt },
      });

      // Fire and forget - the task handles everything including notifications
      await runScheduledJob.trigger({ jobId: job.id });
    }

    console.log(
      `[checkScheduledJobs] Triggered ${dueJobs.length} job(s) for user ${context.userId}`,
    );

    // Don't notify from the hook - the runScheduledJob task handles sending messages
    return { shouldNotify: false };
  } catch (error) {
    console.error("[checkScheduledJobs] Error checking scheduled jobs:", error);
    return { shouldNotify: false };
  }
}
