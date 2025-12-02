import { getConnection } from "@/src/db/connection";
import {
  createResearchJob,
  type CreateResearchJobInput,
  type ResearchTask,
} from "@/src/db/researchJob";
import { getUserById } from "@/src/db/user";
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
 * Analyzes the connected provider and runs deep person research on first connection
 */
export async function queueOAuthResearchJob(params: {
  userId: string;
  provider: "gmail" | "github" | "calendar";
  isFirstConnection: boolean;
  userEmail?: string;
  userName?: string;
}): Promise<{ jobId: string; handle: unknown }> {
  const tasks: ResearchTask[] = [
    // First: analyze the connected provider (extracts company, role, etc.)
    { type: "analyze_provider", provider: params.provider },
  ];

  // On first connection, run deep person research
  // This runs AFTER analyze_provider, so it can use extracted context
  if (params.isFirstConnection) {
    tasks.push({
      type: "deep_person_research",
      name: params.userName,
      email: params.userEmail,
      // company/role/location will be pulled from UserContext
      // (populated by analyze_provider task that runs first)
    });
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

// Provider to connection provider mapping
const PROVIDER_TO_CONNECTION: Record<
  "gmail" | "github" | "calendar",
  "google_gmail" | "github" | "google_calendar"
> = {
  gmail: "google_gmail",
  github: "github",
  calendar: "google_calendar",
};

/**
 * Create a comprehensive research job that includes ALL connected providers
 * and web search. This always re-runs research on all providers to keep
 * user context fresh and up-to-date.
 *
 * By default, this runs every 8 hours via the proactive scheduler.
 */
export async function queueComprehensiveResearchJob(params: {
  userId: string;
  webSearchQueries?: string[];
  /** Trigger type for the job (default: "manual") */
  triggerType?: "manual" | "scheduled";
  /** Whether to notify the user when complete (default: true for manual, false for scheduled) */
  notify?: boolean;
}): Promise<{
  jobId: string;
  handle: unknown;
  analyzingProviders: ("gmail" | "github" | "calendar")[];
  includingWebSearch: boolean;
}> {
  const { userId, webSearchQueries, triggerType = "manual" } = params;
  // Default: notify for manual triggers, don't notify for scheduled (too noisy)
  const shouldNotify = params.notify ?? triggerType === "manual";

  const tasks: ResearchTask[] = [];
  const analyzingProviders: ("gmail" | "github" | "calendar")[] = [];

  // Always analyze ALL connected providers (no skipping)
  const allProviders: ("gmail" | "github" | "calendar")[] = [
    "gmail",
    "github",
    "calendar",
  ];

  for (const provider of allProviders) {
    // Check if provider is connected
    const connectionProvider = PROVIDER_TO_CONNECTION[provider];
    const connection = await getConnection(userId, connectionProvider).catch(
      () => null,
    );

    if (connection?.status === "connected") {
      tasks.push({ type: "analyze_provider", provider });
      analyzingProviders.push(provider);
      console.log(`[ComprehensiveResearch] Will analyze ${provider}`);
    }
  }

  // Always include web search
  let includingWebSearch = false;

  if (webSearchQueries && webSearchQueries.length > 0) {
    // Use user-provided queries if given
    tasks.push({ type: "web_search", queries: webSearchQueries });
    includingWebSearch = true;
  } else {
    // Generate queries from user context for web search
    const user = await getUserById(userId);
    if (user) {
      // Build search queries from available user info
      const queries: string[] = [];

      if (user.name) {
        queries.push(user.name);
        queries.push(`"${user.name}" professional`);
        queries.push(`${user.name} LinkedIn`);
      }

      if (user.email) {
        const domain = user.email.split("@")[1];
        const personalDomains = [
          "gmail.com",
          "yahoo.com",
          "hotmail.com",
          "outlook.com",
          "icloud.com",
          "me.com",
        ];
        if (domain && !personalDomains.includes(domain)) {
          queries.push(`${domain} company`);
          if (user.name) {
            queries.push(`${user.name} ${domain}`);
          }
        }
      }

      if (queries.length > 0) {
        tasks.push({ type: "web_search", queries });
        includingWebSearch = true;
      }
    }
  }

  // Add deep person research at the end if we have any providers or can search
  if (analyzingProviders.length > 0 || includingWebSearch) {
    const user = await getUserById(userId);
    if (user?.name || user?.email) {
      tasks.push({
        type: "deep_person_research",
        name: user.name ?? undefined,
        email: user.email ?? undefined,
      });
    }
  }

  if (tasks.length === 0) {
    throw new Error(
      "No connected accounts found and no search queries provided. " +
        "Connect at least one account or provide specific search queries.",
    );
  }

  console.log(
    `[ComprehensiveResearch] Starting ${triggerType} job with ${tasks.length} tasks`,
    { analyzingProviders, includingWebSearch, notify: shouldNotify },
  );

  const result = await queueResearchJob({
    targetType: "user",
    targetId: userId,
    trigger: {
      type: triggerType,
      metadata: { comprehensive: true },
    },
    tasks,
    notify: shouldNotify,
    // For scheduled jobs, only notify if significant findings
    notifyOnlyIfSignificant: triggerType === "scheduled",
  });

  return {
    ...result,
    analyzingProviders,
    includingWebSearch,
  };
}
