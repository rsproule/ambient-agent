/**
 * Database operations for ScheduledJobs
 *
 * Handles CRUD operations for user-defined scheduled/fuzzy jobs
 */

import prisma from "@/src/db/client";
import type {
  Prisma,
  ScheduledJobNotifyMode,
} from "@/src/generated/prisma";
import { CronExpressionParser } from "cron-parser";

// ============================================
// Types
// ============================================

export interface ScheduledJob {
  id: string;
  userId: string;
  conversationId: string; // Phone number (DM) or group_id (group chat)
  isGroup: boolean; // Whether this was created in a group chat
  name: string;
  prompt: string;
  cronSchedule: string;
  timezone: string | null;
  notifyMode: ScheduledJobNotifyMode;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastResult: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledJobInput {
  userId: string;
  conversationId: string; // Phone number (DM) or group_id (group chat)
  isGroup?: boolean; // Whether this is a group chat (defaults to false)
  name: string;
  prompt: string;
  cronSchedule: string;
  timezone?: string;
  notifyMode?: ScheduledJobNotifyMode;
}

export interface UpdateScheduledJobInput {
  name?: string;
  prompt?: string;
  cronSchedule?: string;
  timezone?: string;
  notifyMode?: ScheduledJobNotifyMode;
  enabled?: boolean;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new scheduled job
 */
export async function createScheduledJob(
  input: CreateScheduledJobInput,
): Promise<ScheduledJob> {
  // Calculate the next run time based on cron schedule
  const nextRunAt = calculateNextRun(input.cronSchedule, input.timezone);

  const job = await prisma.scheduledJob.create({
    data: {
      userId: input.userId,
      conversationId: input.conversationId,
      isGroup: input.isGroup ?? false,
      name: input.name,
      prompt: input.prompt,
      cronSchedule: input.cronSchedule,
      timezone: input.timezone,
      notifyMode: input.notifyMode || "significant",
      nextRunAt,
    },
  });

  return formatScheduledJob(job);
}

/**
 * Get a scheduled job by ID
 */
export async function getScheduledJob(
  jobId: string,
): Promise<ScheduledJob | null> {
  const job = await prisma.scheduledJob.findUnique({
    where: { id: jobId },
  });

  return job ? formatScheduledJob(job) : null;
}

/**
 * Get all scheduled jobs for a user
 */
export async function getScheduledJobsForUser(
  userId: string,
  options?: {
    enabledOnly?: boolean;
  },
): Promise<ScheduledJob[]> {
  const jobs = await prisma.scheduledJob.findMany({
    where: {
      userId,
      ...(options?.enabledOnly && { enabled: true }),
    },
    orderBy: { createdAt: "desc" },
  });

  return jobs.map(formatScheduledJob);
}

/**
 * Update a scheduled job
 */
export async function updateScheduledJob(
  jobId: string,
  updates: UpdateScheduledJobInput,
): Promise<ScheduledJob> {
  // If cron schedule is being updated, recalculate next run time
  let nextRunAt: Date | undefined;
  if (updates.cronSchedule) {
    nextRunAt = calculateNextRun(updates.cronSchedule, updates.timezone);
  }

  const job = await prisma.scheduledJob.update({
    where: { id: jobId },
    data: {
      ...updates,
      ...(nextRunAt && { nextRunAt }),
    },
  });

  return formatScheduledJob(job);
}

/**
 * Delete a scheduled job
 */
export async function deleteScheduledJob(jobId: string): Promise<void> {
  await prisma.scheduledJob.delete({
    where: { id: jobId },
  });
}

/**
 * Enable or disable a scheduled job
 */
export async function setScheduledJobEnabled(
  jobId: string,
  enabled: boolean,
): Promise<ScheduledJob> {
  const job = await prisma.scheduledJob.update({
    where: { id: jobId },
    data: { enabled },
  });

  return formatScheduledJob(job);
}

// ============================================
// Job Execution Operations
// ============================================

/**
 * Get all due scheduled jobs (jobs where nextRunAt <= now)
 */
export async function getDueScheduledJobs(): Promise<ScheduledJob[]> {
  const now = new Date();

  const jobs = await prisma.scheduledJob.findMany({
    where: {
      enabled: true,
      nextRunAt: {
        lte: now,
      },
    },
    orderBy: { nextRunAt: "asc" },
  });

  return jobs.map(formatScheduledJob);
}

/**
 * Get due scheduled jobs for a specific user
 */
export async function getDueScheduledJobsForUser(
  userId: string,
): Promise<ScheduledJob[]> {
  const now = new Date();

  const jobs = await prisma.scheduledJob.findMany({
    where: {
      userId,
      enabled: true,
      nextRunAt: {
        lte: now,
      },
    },
    orderBy: { nextRunAt: "asc" },
  });

  return jobs.map(formatScheduledJob);
}

/**
 * Update job after it has run
 * Sets lastRunAt, computes new nextRunAt, and optionally stores result
 */
export async function updateJobAfterRun(
  jobId: string,
  result?: unknown,
): Promise<ScheduledJob> {
  // First get the job to access its cron schedule
  const existingJob = await prisma.scheduledJob.findUnique({
    where: { id: jobId },
  });

  if (!existingJob) {
    throw new Error(`ScheduledJob not found: ${jobId}`);
  }

  const now = new Date();
  const nextRunAt = calculateNextRun(
    existingJob.cronSchedule,
    existingJob.timezone,
  );

  const job = await prisma.scheduledJob.update({
    where: { id: jobId },
    data: {
      lastRunAt: now,
      nextRunAt,
      ...(result !== undefined && {
        lastResult: result as Prisma.InputJsonValue,
      }),
    },
  });

  return formatScheduledJob(job);
}

/**
 * Mark job as failed (optionally disable it)
 */
export async function markJobFailed(
  jobId: string,
  disableOnFailure: boolean = false,
): Promise<ScheduledJob> {
  const existingJob = await prisma.scheduledJob.findUnique({
    where: { id: jobId },
  });

  if (!existingJob) {
    throw new Error(`ScheduledJob not found: ${jobId}`);
  }

  const now = new Date();
  const nextRunAt = disableOnFailure
    ? existingJob.nextRunAt
    : calculateNextRun(existingJob.cronSchedule, existingJob.timezone);

  const job = await prisma.scheduledJob.update({
    where: { id: jobId },
    data: {
      lastRunAt: now,
      nextRunAt,
      ...(disableOnFailure && { enabled: false }),
    },
  });

  return formatScheduledJob(job);
}

// ============================================
// Helpers
// ============================================

/**
 * Calculate the next run time based on cron schedule
 */
export function calculateNextRun(
  cronSchedule: string,
  timezone?: string | null,
): Date {
  try {
    const expression = CronExpressionParser.parse(cronSchedule, {
      currentDate: new Date(),
      tz: timezone || "America/Los_Angeles",
    });
    return expression.next().toDate();
  } catch (error) {
    console.error(
      `[ScheduledJob] Failed to parse cron expression: ${cronSchedule}`,
      error,
    );
    // Default to 24 hours from now if cron parsing fails
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 24);
    return fallback;
  }
}

/**
 * Validate a cron expression
 */
export function isValidCronExpression(cronSchedule: string): boolean {
  try {
    CronExpressionParser.parse(cronSchedule);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get human-readable description of next run
 */
export function getNextRunDescription(job: ScheduledJob): string {
  if (!job.nextRunAt) {
    return "Not scheduled";
  }

  const now = new Date();
  const diff = job.nextRunAt.getTime() - now.getTime();

  if (diff < 0) {
    return "Due now";
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) {
    return `In ${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `In ${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `In ${minutes} minute${minutes > 1 ? "s" : ""}`;
}

function formatScheduledJob(job: {
  id: string;
  userId: string;
  conversationId: string;
  isGroup: boolean;
  name: string;
  prompt: string;
  cronSchedule: string;
  timezone: string | null;
  notifyMode: ScheduledJobNotifyMode;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastResult: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ScheduledJob {
  return {
    id: job.id,
    userId: job.userId,
    conversationId: job.conversationId,
    isGroup: job.isGroup,
    name: job.name,
    prompt: job.prompt,
    cronSchedule: job.cronSchedule,
    timezone: job.timezone,
    notifyMode: job.notifyMode,
    enabled: job.enabled,
    lastRunAt: job.lastRunAt,
    nextRunAt: job.nextRunAt,
    lastResult: job.lastResult,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

