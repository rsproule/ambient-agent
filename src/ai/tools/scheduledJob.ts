/**
 * AI Tool for creating and managing scheduled jobs
 *
 * Allows Whiskers to create user-defined scheduled tasks
 * that run prompts on a cron schedule (e.g., "check AI news every morning")
 */

import { getUserByPhoneNumber } from "@/src/db/user";
import {
  createScheduledJob,
  deleteScheduledJob,
  getNextRunDescription,
  getScheduledJobsForUser,
  isValidCronExpression,
  setScheduledJobEnabled,
} from "@/src/db/scheduledJob";
import { getUserContext } from "@/src/db/userContext";
import { generateObject, tool, zodSchema } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

/**
 * LLM-based schedule parsing
 * Converts natural language schedule descriptions to cron expressions
 */
async function parseScheduleToCron(
  scheduleDescription: string,
  timezone?: string,
): Promise<{ cronExpression: string; interpretation: string }> {
  const result = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: z.object({
      cronExpression: z
        .string()
        .describe(
          "Standard 5-field cron expression (minute hour day-of-month month day-of-week)",
        ),
      interpretation: z
        .string()
        .describe("Human-readable interpretation of the schedule"),
    }),
    prompt: `Convert this schedule description to a cron expression.

Schedule: "${scheduleDescription}"
${timezone ? `User timezone: ${timezone}` : "Assume US Pacific timezone"}

Common cron patterns:
- "0 9 * * *" = Every day at 9am
- "0 9 * * 1-5" = Weekdays at 9am
- "0 8,17 * * *" = Twice daily at 8am and 5pm
- "0 9 * * 1" = Every Monday at 9am
- "0 0 1 * *" = First of every month at midnight
- "*/30 * * * *" = Every 30 minutes

Return a valid 5-field cron expression and a human-readable interpretation.
The cron expression should make sense for the described schedule.`,
  });

  return result.object;
}

/**
 * Tool for creating a new scheduled job
 */
export const createScheduledJobTool = tool({
  description:
    "Create a scheduled job that runs a prompt on a recurring schedule. " +
    "Use this when a user asks you to do something regularly, like 'check the news every morning' " +
    "or 'remind me about my meetings every day'. " +
    "The schedule is specified in natural language and will be converted to a cron schedule. " +
    "IMPORTANT: Confirm with the user what they want checked and how often before creating the job.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format)"),
      name: z
        .string()
        .describe(
          "A short, descriptive name for the job (e.g., 'AI News Check', 'Morning Meeting Reminder')",
        ),
      prompt: z
        .string()
        .describe(
          "The prompt/instruction to run on schedule. Be specific about what to search for or check. " +
            "Example: 'Search for the latest news about AI developer tools and summarize the most interesting findings'",
        ),
      scheduleDescription: z
        .string()
        .describe(
          "Natural language description of when to run (e.g., 'every morning at 9am', " +
            "'twice a day', 'every weekday', 'once a week on Monday')",
        ),
      notifyMode: z
        .enum(["always", "significant"])
        .optional()
        .default("significant")
        .describe(
          "When to notify: 'always' = notify every run, 'significant' = only notify if results are interesting/new",
        ),
    }),
  ),
  execute: async ({
    phoneNumber,
    name,
    prompt,
    scheduleDescription,
    notifyMode,
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

      // Get user's timezone from context
      const context = await getUserContext(user.id);
      const timezone = context?.timezone || "America/Los_Angeles";

      // Parse schedule to cron using LLM
      const { cronExpression, interpretation } = await parseScheduleToCron(
        scheduleDescription,
        timezone,
      );

      // Validate the cron expression
      if (!isValidCronExpression(cronExpression)) {
        return {
          success: false,
          message: `Failed to create a valid schedule from "${scheduleDescription}". Please try describing the schedule differently.`,
        };
      }

      // Create the scheduled job
      const job = await createScheduledJob({
        userId: user.id,
        name,
        prompt,
        cronSchedule: cronExpression,
        timezone,
        notifyMode: notifyMode || "significant",
      });

      const nextRunDesc = getNextRunDescription(job);

      return {
        success: true,
        message:
          `Created scheduled job "${name}"! ` +
          `It will run ${interpretation.toLowerCase()}. ` +
          `Next run: ${nextRunDesc}. ` +
          (notifyMode === "always"
            ? "You'll be notified every time it runs."
            : "You'll only be notified when there's something interesting to share."),
        jobId: job.id,
        schedule: {
          cron: cronExpression,
          interpretation,
          timezone,
        },
        nextRunAt: job.nextRunAt?.toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create scheduled job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});

/**
 * Tool for listing user's scheduled jobs
 */
export const listScheduledJobsTool = tool({
  description:
    "List all scheduled jobs for a user. Use this to show what recurring tasks are set up.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format)"),
      enabledOnly: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, only show enabled jobs"),
    }),
  ),
  execute: async ({ phoneNumber, enabledOnly }) => {
    try {
      const user = await getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          success: false,
          message: "User not found.",
        };
      }

      const jobs = await getScheduledJobsForUser(user.id, { enabledOnly });

      if (jobs.length === 0) {
        return {
          success: true,
          message: "No scheduled jobs found.",
          jobs: [],
        };
      }

      const jobSummaries = jobs.map((job) => ({
        id: job.id,
        name: job.name,
        prompt: job.prompt,
        schedule: job.cronSchedule,
        timezone: job.timezone,
        enabled: job.enabled,
        notifyMode: job.notifyMode,
        nextRun: job.nextRunAt
          ? getNextRunDescription(job)
          : "Not scheduled",
        lastRun: job.lastRunAt?.toISOString() || "Never",
      }));

      return {
        success: true,
        message: `Found ${jobs.length} scheduled job${jobs.length > 1 ? "s" : ""}.`,
        jobs: jobSummaries,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list scheduled jobs: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});

/**
 * Tool for deleting a scheduled job
 */
export const deleteScheduledJobTool = tool({
  description:
    "Delete a scheduled job. Use this when a user wants to stop a recurring task.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format)"),
      jobId: z.string().describe("The ID of the job to delete"),
    }),
  ),
  execute: async ({ phoneNumber, jobId }) => {
    try {
      const user = await getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          success: false,
          message: "User not found.",
        };
      }

      // Verify job belongs to user
      const jobs = await getScheduledJobsForUser(user.id);
      const job = jobs.find((j) => j.id === jobId);

      if (!job) {
        return {
          success: false,
          message: "Job not found or doesn't belong to this user.",
        };
      }

      await deleteScheduledJob(jobId);

      return {
        success: true,
        message: `Deleted scheduled job "${job.name}".`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete scheduled job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});

/**
 * Tool for enabling/disabling a scheduled job
 */
export const toggleScheduledJobTool = tool({
  description:
    "Enable or disable a scheduled job without deleting it. " +
    "Use this to pause or resume a recurring task.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format)"),
      jobId: z.string().describe("The ID of the job to toggle"),
      enabled: z.boolean().describe("Whether to enable (true) or disable (false) the job"),
    }),
  ),
  execute: async ({ phoneNumber, jobId, enabled }) => {
    try {
      const user = await getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          success: false,
          message: "User not found.",
        };
      }

      // Verify job belongs to user
      const jobs = await getScheduledJobsForUser(user.id);
      const existingJob = jobs.find((j) => j.id === jobId);

      if (!existingJob) {
        return {
          success: false,
          message: "Job not found or doesn't belong to this user.",
        };
      }

      const job = await setScheduledJobEnabled(jobId, enabled);

      return {
        success: true,
        message: enabled
          ? `Enabled scheduled job "${job.name}". Next run: ${getNextRunDescription(job)}.`
          : `Disabled scheduled job "${job.name}". It won't run until re-enabled.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to toggle scheduled job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});

