import prisma from "@/src/db/client";
import type { Prisma, ResearchJobStatus } from "@/src/generated/prisma";

// ============================================
// Types
// ============================================

export type ResearchTaskType =
  | "analyze_provider"
  | "web_search"
  | "store_fact"
  | "deep_person_research";

export interface AnalyzeProviderTask {
  type: "analyze_provider";
  provider: "gmail" | "github" | "calendar";
}

export interface WebSearchTask {
  type: "web_search";
  queries: string[];
}

export interface StoreFactTask {
  type: "store_fact";
  content: string;
  invalidates?: string[]; // Queries to mark as stale
}

/**
 * Deep person research task
 * Uses context already extracted from providers + any provided hints
 * to run comprehensive web research on the user
 */
export interface DeepPersonResearchTask {
  type: "deep_person_research";
  // Optional hints to seed the research (will also pull from UserContext)
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  location?: string;
}

export type ResearchTask =
  | AnalyzeProviderTask
  | WebSearchTask
  | StoreFactTask
  | DeepPersonResearchTask;

export interface PostProcessConfig {
  notify: boolean;
  notifyOnlyIfSignificant?: boolean;
}

export interface CreateResearchJobInput {
  targetType: "user" | "conversation";
  targetId: string;
  triggerType: "oauth" | "conversation" | "manual" | "scheduled";
  triggerSource?: string;
  triggerMeta?: Record<string, unknown>;
  tasks: ResearchTask[];
  postProcess?: PostProcessConfig;
}

export interface ResearchJob {
  id: string;
  targetType: string;
  targetId: string;
  triggerType: string;
  triggerSource: string | null;
  triggerMeta: Record<string, unknown> | null;
  tasks: ResearchTask[];
  postProcess: PostProcessConfig | null;
  status: ResearchJobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new research job
 */
export async function createResearchJob(
  input: CreateResearchJobInput,
): Promise<ResearchJob> {
  const job = await prisma.researchJob.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      triggerType: input.triggerType,
      triggerSource: input.triggerSource,
      triggerMeta: input.triggerMeta as Prisma.InputJsonValue | undefined,
      tasks: input.tasks as unknown as Prisma.InputJsonValue,
      postProcess: input.postProcess as Prisma.InputJsonValue | undefined,
    },
  });

  return formatResearchJob(job);
}

/**
 * Get a research job by ID
 */
export async function getResearchJob(id: string): Promise<ResearchJob | null> {
  const job = await prisma.researchJob.findUnique({
    where: { id },
  });

  return job ? formatResearchJob(job) : null;
}

/**
 * Update research job status
 */
export async function updateResearchJobStatus(
  id: string,
  status: ResearchJobStatus,
  updates?: {
    result?: Record<string, unknown>;
    error?: string;
  },
): Promise<ResearchJob> {
  const data: Prisma.ResearchJobUpdateInput = {
    status,
    ...(status === "running" && { startedAt: new Date() }),
    ...(status === "completed" && { completedAt: new Date() }),
    ...(status === "failed" && { completedAt: new Date() }),
    ...(updates?.result && { result: updates.result as Prisma.InputJsonValue }),
    ...(updates?.error && { error: updates.error }),
  };

  const job = await prisma.researchJob.update({
    where: { id },
    data,
  });

  return formatResearchJob(job);
}

/**
 * Get pending jobs for a target
 */
export async function getPendingJobsForTarget(
  targetType: string,
  targetId: string,
): Promise<ResearchJob[]> {
  const jobs = await prisma.researchJob.findMany({
    where: {
      targetType,
      targetId,
      status: "pending",
    },
    orderBy: { createdAt: "asc" },
  });

  return jobs.map(formatResearchJob);
}

/**
 * Get recent jobs for a target
 */
export async function getRecentJobsForTarget(
  targetType: string,
  targetId: string,
  limit: number = 10,
): Promise<ResearchJob[]> {
  const jobs = await prisma.researchJob.findMany({
    where: {
      targetType,
      targetId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jobs.map(formatResearchJob);
}

/**
 * Check if there's already a running job for a target
 */
export async function hasRunningJob(
  targetType: string,
  targetId: string,
): Promise<boolean> {
  const count = await prisma.researchJob.count({
    where: {
      targetType,
      targetId,
      status: "running",
    },
  });

  return count > 0;
}

// ============================================
// Helpers
// ============================================

function formatResearchJob(job: {
  id: string;
  targetType: string;
  targetId: string;
  triggerType: string;
  triggerSource: string | null;
  triggerMeta: unknown;
  tasks: unknown;
  postProcess: unknown;
  status: ResearchJobStatus;
  result: unknown;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): ResearchJob {
  return {
    id: job.id,
    targetType: job.targetType,
    targetId: job.targetId,
    triggerType: job.triggerType,
    triggerSource: job.triggerSource,
    triggerMeta: job.triggerMeta as Record<string, unknown> | null,
    tasks: job.tasks as ResearchTask[],
    postProcess: job.postProcess as PostProcessConfig | null,
    status: job.status,
    result: job.result as Record<string, unknown> | null,
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
  };
}
