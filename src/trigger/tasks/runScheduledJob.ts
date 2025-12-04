/**
 * Run Scheduled Job Task
 *
 * Executes a single scheduled job by running its prompt through the agent,
 * just like a regular user message. The agent decides what tools to use.
 */

import { mrWhiskersAgent } from "@/src/ai/agents/mrWhiskers";
import { respondToMessage } from "@/src/ai/respondToMessage";
import type { ConversationContext } from "@/src/db/conversation";
import { getScheduledJob, markJobFailed, updateJobAfterRun } from "@/src/db/scheduledJob";
import { getPhoneNumberForUser } from "@/src/db/user";
import { getUserContextByPhone } from "@/src/db/userContext";
import { getUserConnections } from "@/src/db/connection";
import { getGroupChatCustomPrompt } from "@/src/db/groupChatSettings";
import prisma from "@/src/db/client";
import { task } from "@trigger.dev/sdk/v3";
import type { ModelMessage } from "ai";
import { handleMessageResponse } from "./handleMessage";

type RunScheduledJobPayload = {
  jobId: string;
};

/**
 * Build a ConversationContext for a scheduled job
 * This mimics what getConversationMessages does but for scheduled jobs
 */
async function buildScheduledJobContext(
  job: {
    userId: string;
    conversationId: string;
    isGroup: boolean;
    timezone: string | null;
  },
  phoneNumber: string,
): Promise<ConversationContext> {
  const context: ConversationContext = {
    conversationId: job.conversationId,
    isGroup: job.isGroup,
    participants: [],
    sender: phoneNumber, // The job runs on behalf of the user who created it
  };

  // Get the conversation if it exists (for group info)
  const conversation = await prisma.conversation.findUnique({
    where: { conversationId: job.conversationId },
  });

  if (conversation) {
    context.participants = conversation.participants;
    context.groupName = conversation.groupName ?? undefined;
    context.summary = conversation.summary ?? undefined;
  }

  // For group chats, get participant info and custom prompt
  if (job.isGroup && conversation?.participants?.length) {
    try {
      context.groupParticipants = await Promise.all(
        conversation.participants.map(async (participantPhone) => {
          const participantContext = await getUserContextByPhone(participantPhone);
          const user = await prisma.user.findUnique({
            where: { phoneNumber: participantPhone },
            select: { name: true },
          });

          let brief: string | undefined;
          if (participantContext?.summary) {
            const firstSentence = participantContext.summary.split(/[.!?]/)[0];
            brief = firstSentence ? firstSentence.trim() : undefined;
          }

          return {
            phoneNumber: participantPhone,
            name: user?.name ?? undefined,
            brief,
          };
        }),
      );

      context.groupChatCustomPrompt = await getGroupChatCustomPrompt(job.conversationId);
    } catch (error) {
      console.warn(`[RunScheduledJob] Failed to fetch group info:`, error);
    }
  }

  // For DMs, get user context and system state
  if (!job.isGroup) {
    try {
      // Get user with outboundOptIn field from Prisma directly
      const user = await prisma.user.findUnique({
        where: { id: job.userId },
        select: { id: true, outboundOptIn: true },
      });

      if (user) {
        // Get user context
        const userContext = await getUserContextByPhone(phoneNumber);
        if (userContext) {
          context.userContext = {
            summary: userContext.summary,
            interests: userContext.interests,
            professional: userContext.professional,
            facts: userContext.facts,
            recentDocuments: userContext.documents?.slice(0, 5).map((d) => ({
              title: d.title,
              source: d.source,
            })),
          };
        }

        // Get connection status
        const connections = await getUserConnections(job.userId);
        const gmailConnected = connections.some(
          (c) => c.provider === "google_gmail" && c.status === "connected",
        );
        const githubConnected = connections.some(
          (c) => c.provider === "github" && c.status === "connected",
        );
        const calendarConnected = connections.some(
          (c) => c.provider === "google_calendar" && c.status === "connected",
        );
        const twitterConnected = connections.some(
          (c) => c.provider === "twitter" && c.status === "connected",
        );

        const timezone = job.timezone || userContext?.timezone || "America/Los_Angeles";
        const now = new Date();

        context.systemState = {
          currentTime: {
            iso: now.toISOString(),
            formatted: now.toLocaleString("en-US", {
              timeZone: timezone,
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
            timezone,
            dayOfWeek: now.toLocaleString("en-US", {
              timeZone: timezone,
              weekday: "long",
            }),
          },
          connections: {
            gmail: gmailConnected,
            github: githubConnected,
            calendar: calendarConnected,
            twitter: twitterConnected,
          },
          hasAnyConnection: gmailConnected || githubConnected || calendarConnected || twitterConnected,
          researchStatus: userContext ? "completed" : "none",
          outboundOptIn: user.outboundOptIn,
          timezoneSource: timezone ? "known" : "default",
          isOnboarding: false, // Scheduled jobs only run for established users
        };
      }
    } catch (error) {
      console.warn(`[RunScheduledJob] Failed to fetch user context:`, error);
    }
  }

  // Ensure we always have at least basic system state
  if (!context.systemState) {
    const timezone = job.timezone || "America/Los_Angeles";
    const now = new Date();
    context.systemState = {
      currentTime: {
        iso: now.toISOString(),
        formatted: now.toLocaleString("en-US", {
          timeZone: timezone,
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        timezone,
        dayOfWeek: now.toLocaleString("en-US", {
          timeZone: timezone,
          weekday: "long",
        }),
      },
      connections: { gmail: false, github: false, calendar: false, twitter: false },
      hasAnyConnection: false,
    };
  }

  return context;
}

/**
 * Execute a scheduled job by running its prompt through the agent
 */
export const runScheduledJob = task({
  id: "run-scheduled-job",
  machine: {
    preset: "medium-1x", // Match debouncedResponse for AI SDK
  },
  run: async (payload: RunScheduledJobPayload, { ctx }) => {
    const { jobId } = payload;
    const taskId = ctx.run.id;

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
      // Build conversation context for the job
      const context = await buildScheduledJobContext(job, phoneNumber);

      console.log(`[RunScheduledJob] Executing prompt for job "${job.name}": ${job.prompt}`);

      // Create a synthetic message with the job's prompt
      // This looks like a system instruction for the agent
      const syntheticMessage: ModelMessage = {
        role: "user",
        content:
          `[SCHEDULED JOB: "${job.name}"]\n` +
          `This is an automated scheduled task. Execute the following instruction and respond naturally:\n\n` +
          `${job.prompt}\n\n` +
          `Note: This is a scheduled job, not a direct user message. ` +
          `Respond as if you're proactively sharing something useful with the user.`,
      };

      // Run the prompt through the agent (just like a regular message)
      const actions = await respondToMessage(
        mrWhiskersAgent,
        [syntheticMessage],
        context,
      );

      // Update job with results (store summary of what was generated)
      await updateJobAfterRun(jobId, {
        executedAt: new Date().toISOString(),
        actionsGenerated: actions.length,
        prompt: job.prompt,
      });

      // If no actions, the agent decided not to respond
      if (actions.length === 0) {
        console.log(`[RunScheduledJob] Job ${jobId} completed, no actions generated`);
        return {
          success: true,
          notified: false,
          reason: "no_actions_generated",
        };
      }

      // Determine notification target based on job context
      const isGroup = job.isGroup;
      const recipient = isGroup ? undefined : phoneNumber;
      const group = isGroup ? job.conversationId : undefined;

      // Execute the actions via handleMessageResponse
      await handleMessageResponse.triggerAndWait({
        conversationId: job.conversationId,
        recipient,
        group,
        actions,
        taskId,
        sender: phoneNumber,
        isGroup,
      });

      console.log(`[RunScheduledJob] Job ${jobId} completed and user notified`);

      return {
        success: true,
        notified: true,
        actionsExecuted: actions.length,
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
