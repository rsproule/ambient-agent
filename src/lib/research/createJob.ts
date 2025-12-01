import {
  createResearchJob,
  type CreateResearchJobInput,
  type ResearchTask,
} from "@/src/db/researchJob";
import { runResearchJob } from "@/src/trigger/tasks/runResearchJob";

/**
 * Queue a research job for execution
 * Creates the job in the database and triggers the background task
 */
export async function queueResearchJob(params: {
  targetType: "user" | "conversation";
  targetId: string;
  trigger: {
    type: "oauth" | "conversation" | "manual" | "scheduled";
    source?: string;
    metadata?: Record<string, unknown>;
  };
  tasks: ResearchTask[];
  notify?: boolean;
  notifyOnlyIfSignificant?: boolean;
}): Promise<{ jobId: string; handle: unknown }> {
  // Create the job record
  const jobInput: CreateResearchJobInput = {
    targetType: params.targetType,
    targetId: params.targetId,
    triggerType: params.trigger.type,
    triggerSource: params.trigger.source,
    triggerMeta: params.trigger.metadata,
    tasks: params.tasks,
    postProcess:
      params.notify !== undefined
        ? {
            notify: params.notify,
            notifyOnlyIfSignificant: params.notifyOnlyIfSignificant,
          }
        : undefined,
  };

  const job = await createResearchJob(jobInput);

  // Trigger the background task
  const handle = await runResearchJob.trigger({ jobId: job.id });

  return { jobId: job.id, handle };
}

/**
 * Create a research job for a new OAuth connection
 * Analyzes the connected provider and optionally runs web search (first connection)
 */
export async function queueOAuthResearchJob(params: {
  userId: string;
  provider: "gmail" | "github" | "calendar";
  isFirstConnection: boolean;
  userEmail?: string;
  userName?: string;
}): Promise<{ jobId: string; handle: unknown }> {
  const tasks: ResearchTask[] = [
    { type: "analyze_provider", provider: params.provider },
  ];

  // On first connection, also run web search if we have user info
  if (params.isFirstConnection) {
    const queries: string[] = [];
    if (params.userName) {
      queries.push(params.userName);
    }
    if (params.userEmail) {
      // Extract domain for company research
      const domain = params.userEmail.split("@")[1];
      if (
        domain &&
        !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(
          domain,
        )
      ) {
        queries.push(domain);
      }
    }
    if (queries.length > 0) {
      tasks.push({ type: "web_search", queries });
    }
  }

  return queueResearchJob({
    targetType: "user",
    targetId: params.userId,
    trigger: {
      type: "oauth",
      source: params.provider,
      metadata: { isFirstConnection: params.isFirstConnection },
    },
    tasks,
    notify: true,
    notifyOnlyIfSignificant: !params.isFirstConnection,
  });
}

/**
 * Create a research job from a conversation (user shared info)
 */
export async function queueConversationResearchJob(params: {
  userId: string;
  content: string;
  invalidates?: string[];
  triggerWebSearch?: boolean;
  queries?: string[];
}): Promise<{ jobId: string; handle: unknown }> {
  const tasks: ResearchTask[] = [
    {
      type: "store_fact",
      content: params.content,
      invalidates: params.invalidates,
    },
  ];

  if (params.triggerWebSearch && params.queries && params.queries.length > 0) {
    tasks.push({ type: "web_search", queries: params.queries });
  }

  return queueResearchJob({
    targetType: "user",
    targetId: params.userId,
    trigger: {
      type: "conversation",
      metadata: { content: params.content },
    },
    tasks,
    notify: false, // Don't notify for conversation-triggered updates
  });
}

/**
 * Create a manual research job (user explicitly requested)
 */
export async function queueManualResearchJob(params: {
  userId: string;
  providers?: ("gmail" | "github" | "calendar")[];
  webSearchQueries?: string[];
}): Promise<{ jobId: string; handle: unknown }> {
  const tasks: ResearchTask[] = [];

  // Add provider analysis tasks
  if (params.providers) {
    for (const provider of params.providers) {
      tasks.push({ type: "analyze_provider", provider });
    }
  }

  // Add web search if queries provided
  if (params.webSearchQueries && params.webSearchQueries.length > 0) {
    tasks.push({ type: "web_search", queries: params.webSearchQueries });
  }

  return queueResearchJob({
    targetType: "user",
    targetId: params.userId,
    trigger: {
      type: "manual",
    },
    tasks,
    notify: true,
  });
}
