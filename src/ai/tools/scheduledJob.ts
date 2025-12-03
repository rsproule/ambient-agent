/**
 * AI Tool for creating and managing scheduled jobs
 *
 * Allows Whiskers to create user-defined scheduled tasks
 * that run prompts on a cron schedule (e.g., "check AI news every morning")
 *
 * Security: Phone number is taken from authenticated context, not user input.
 */

import type { ConversationContext } from "@/src/db/conversation";
import { getUserByPhoneNumber } from "@/src/db/user";
import {
  createScheduledJob,
  deleteScheduledJob,
  getNextRunDescription,
  getScheduledJobsForUser,
  isValidCronExpression,
  setScheduledJobEnabled,
  updateScheduledJob,
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
 * Create context-bound scheduled job tools
 */
export function createScheduledJobTools(context: ConversationContext) {
  // Get the authenticated phone number from context (system-provided, cannot be spoofed)
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return {
    /**
     * Tool for creating a new scheduled job
     */
    createScheduledJob: tool({
      description:
        "Create a NEW scheduled job that runs a prompt on a recurring schedule. " +
        "Use this when the user asks you to do something regularly, like 'check the news every morning' " +
        "or 'remind me about my meetings every day'. " +
        "IMPORTANT: Before creating a new job, ALWAYS use listScheduledJobs first to check if a similar job already exists. " +
        "If a similar job exists, use updateScheduledJob instead to modify it. " +
        "Only create a new job if no similar job exists.",
      inputSchema: zodSchema(
        z.object({
          name: z
            .string()
            .describe(
              "A short, descriptive name for the job (e.g., 'AI News Check', 'Morning Meeting Reminder')",
            ),
          prompt: z
            .string()
            .describe(
              "The prompt/instruction to run on schedule. This can be any task - search, generate content, check something, etc. " +
                "Example: 'Search for the latest news about AI developer tools' or 'Generate a motivational quote'",
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
      execute: async ({ name, prompt, scheduleDescription, notifyMode }) => {
        try {
          if (!authenticatedPhone) {
            return {
              success: false,
              message: "Could not identify user. Please try again.",
            };
          }

          // Get user
          const user = await getUserByPhoneNumber(authenticatedPhone);
          if (!user) {
            return {
              success: false,
              message:
                "User not found. You may need to set up your account first.",
            };
          }

          // Check for existing jobs with similar names to prevent duplicates
          const existingJobs = await getScheduledJobsForUser(user.id);
          const similarJob = existingJobs.find(
            (j) => j.name.toLowerCase() === name.toLowerCase(),
          );

          if (similarJob) {
            return {
              success: false,
              message:
                `A scheduled job named "${similarJob.name}" already exists (ID: ${similarJob.id}). ` +
                `Use updateScheduledJob to modify it instead of creating a duplicate.`,
              existingJob: {
                id: similarJob.id,
                name: similarJob.name,
                prompt: similarJob.prompt,
                schedule: similarJob.cronSchedule,
              },
            };
          }

          // Get user's timezone from context
          const userContext = await getUserContext(user.id);
          const timezone = userContext?.timezone || "America/Los_Angeles";

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

          // Create the scheduled job with conversation context
          const job = await createScheduledJob({
            userId: user.id,
            conversationId: context.conversationId,
            isGroup: context.isGroup,
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
    }),

    /**
     * Tool for listing user's scheduled jobs
     */
    listScheduledJobs: tool({
      description:
        "List all scheduled jobs for this user. " +
        "IMPORTANT: Always call this BEFORE creating a new scheduled job to check if a similar one already exists. " +
        "This returns job IDs needed for updateScheduledJob, deleteScheduledJob, and toggleScheduledJob.",
      inputSchema: zodSchema(
        z.object({
          enabledOnly: z
            .boolean()
            .optional()
            .default(false)
            .describe("If true, only show enabled jobs"),
        }),
      ),
      execute: async ({ enabledOnly }) => {
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
              message:
                "User not found. You may need to set up your account first.",
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
    }),

    /**
     * Tool for deleting a scheduled job
     */
    deleteScheduledJob: tool({
      description:
        "Delete a scheduled job. Use this when you want to stop a recurring task.",
      inputSchema: zodSchema(
        z.object({
          jobId: z.string().describe("The ID of the job to delete"),
        }),
      ),
      execute: async ({ jobId }) => {
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
              message:
                "User not found. You may need to set up your account first.",
            };
          }

          // Verify job belongs to user
          const jobs = await getScheduledJobsForUser(user.id);
          const job = jobs.find((j) => j.id === jobId);

          if (!job) {
            return {
              success: false,
              message: "Job not found or doesn't belong to you.",
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
    }),

    /**
     * Tool for enabling/disabling a scheduled job
     */
    toggleScheduledJob: tool({
      description:
        "Enable or disable a scheduled job without deleting it. " +
        "Use this to pause or resume a recurring task.",
      inputSchema: zodSchema(
        z.object({
          jobId: z.string().describe("The ID of the job to toggle"),
          enabled: z
            .boolean()
            .describe("Whether to enable (true) or disable (false) the job"),
        }),
      ),
      execute: async ({ jobId, enabled }) => {
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
              message:
                "User not found. You may need to set up your account first.",
            };
          }

          // Verify job belongs to user
          const jobs = await getScheduledJobsForUser(user.id);
          const existingJob = jobs.find((j) => j.id === jobId);

          if (!existingJob) {
            return {
              success: false,
              message: "Job not found or doesn't belong to you.",
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
    }),

    /**
     * Tool for updating an existing scheduled job
     */
    updateScheduledJob: tool({
      description:
        "Update an existing scheduled job. Use this to modify the name, prompt, schedule, or notification mode " +
        "of an existing job instead of creating a new one. " +
        "IMPORTANT: Use listScheduledJobs first to get the job ID of the job you want to update.",
      inputSchema: zodSchema(
        z.object({
          jobId: z.string().describe("The ID of the job to update (get this from listScheduledJobs)"),
          name: z
            .string()
            .optional()
            .describe("New name for the job (optional)"),
          prompt: z
            .string()
            .optional()
            .describe("New prompt/instruction for the job (optional)"),
          scheduleDescription: z
            .string()
            .optional()
            .describe(
              "New schedule in natural language (optional, e.g., 'every morning at 9am')",
            ),
          notifyMode: z
            .enum(["always", "significant"])
            .optional()
            .describe("New notification mode (optional)"),
        }),
      ),
      execute: async ({ jobId, name, prompt, scheduleDescription, notifyMode }) => {
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
              message:
                "User not found. You may need to set up your account first.",
            };
          }

          // Verify job belongs to user
          const jobs = await getScheduledJobsForUser(user.id);
          const existingJob = jobs.find((j) => j.id === jobId);

          if (!existingJob) {
            return {
              success: false,
              message: "Job not found or doesn't belong to you.",
            };
          }

          // Get user's timezone from context
          const userContext = await getUserContext(user.id);
          const timezone = userContext?.timezone || "America/Los_Angeles";

          // Build updates object
          const updates: {
            name?: string;
            prompt?: string;
            cronSchedule?: string;
            timezone?: string;
            notifyMode?: "always" | "significant";
          } = {};

          if (name) updates.name = name;
          if (prompt) updates.prompt = prompt;
          if (notifyMode) updates.notifyMode = notifyMode;

          // Parse new schedule if provided
          let interpretation: string | undefined;
          if (scheduleDescription) {
            const parsed = await parseScheduleToCron(scheduleDescription, timezone);
            if (!isValidCronExpression(parsed.cronExpression)) {
              return {
                success: false,
                message: `Failed to parse schedule "${scheduleDescription}". Please try describing it differently.`,
              };
            }
            updates.cronSchedule = parsed.cronExpression;
            updates.timezone = timezone;
            interpretation = parsed.interpretation;
          }

          // Update the job
          const job = await updateScheduledJob(jobId, updates);
          const nextRunDesc = getNextRunDescription(job);

          const changedFields: string[] = [];
          if (name) changedFields.push("name");
          if (prompt) changedFields.push("prompt");
          if (scheduleDescription) changedFields.push("schedule");
          if (notifyMode) changedFields.push("notification mode");

          return {
            success: true,
            message:
              `Updated scheduled job "${job.name}"! ` +
              `Changed: ${changedFields.join(", ")}. ` +
              (interpretation ? `New schedule: ${interpretation.toLowerCase()}. ` : "") +
              `Next run: ${nextRunDesc}.`,
            jobId: job.id,
            updatedFields: changedFields,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to update scheduled job: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      },
    }),
  };
}

