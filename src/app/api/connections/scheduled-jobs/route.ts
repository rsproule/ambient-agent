/**
 * Scheduled Jobs API
 *
 * List user's scheduled jobs (both default hooks and user-created)
 */

import prisma from "@/src/db/client";
import { getUserConnections } from "@/src/db/connection";
import { getScheduledJobsForUser } from "@/src/db/scheduledJob";
import { auth } from "@/src/lib/auth/config";
import {
  DEFAULT_HOOK_SCHEDULES,
  type HookName,
} from "@/src/lib/proactive/types";
import { NextResponse } from "next/server";

// Default hook configurations
const DEFAULT_HOOKS: Record<
  string,
  { name: string; prompt: string; requiresConnection?: string }
> = {
  calendar: {
    name: "Calendar Reminders",
    prompt: "Check for upcoming meetings and send reminders",
    requiresConnection: "google_calendar",
  },
  github: {
    name: "GitHub Notifications",
    prompt: "Check for PR reviews and mentions",
    requiresConnection: "github",
  },
  gmail: {
    name: "Email Alerts",
    prompt: "Check for important unread emails",
    requiresConnection: "google_gmail",
  },
  connectionReminder: {
    name: "Connection Reminders",
    prompt: "Remind to connect accounts if none are connected",
  },
};

/**
 * GET /api/connections/scheduled-jobs
 *
 * Get authenticated user's scheduled jobs (default + user-created)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's connections to determine which default hooks are available
    const connections = await getUserConnections(userId);
    const connectedProviders = new Set(
      connections
        .filter((c) => c.status === "connected")
        .map((c) => c.provider)
    );

    // Get user's hook settings
    const userContext = await prisma.userContext.findUnique({
      where: { userId },
    });
    const hookCooldowns =
      (userContext?.hookCooldowns as Record<string, number>) || {};

    // Build default jobs list
    const defaultJobs = Object.entries(DEFAULT_HOOKS).map(
      ([hookId, config]) => {
        const cooldown =
          hookCooldowns[hookId] ?? DEFAULT_HOOK_SCHEDULES[hookId as HookName];
        const enabled = cooldown !== 0;

        // Check if this hook's required connection is active
        const isAvailable =
          !config.requiresConnection ||
          connectedProviders.has(
            config.requiresConnection as
              | "google_gmail"
              | "github"
              | "google_calendar"
          );

        return {
          id: `default:${hookId}`,
          name: config.name,
          prompt: config.prompt,
          cronSchedule: `Every ${formatCooldown(cooldown || DEFAULT_HOOK_SCHEDULES[hookId as HookName])}`,
          enabled: enabled && isAvailable,
          notifyMode: "significant" as const,
          isDefault: true,
          isAvailable,
          requiresConnection: config.requiresConnection,
          cooldownMinutes:
            cooldown || DEFAULT_HOOK_SCHEDULES[hookId as HookName],
        };
      }
    );

    // Get user-created jobs
    const userJobs = await getScheduledJobsForUser(userId);

    return NextResponse.json({
      jobs: [
        ...defaultJobs,
        ...userJobs.map((job) => ({
          id: job.id,
          name: job.name,
          prompt: job.prompt,
          cronSchedule: job.cronSchedule,
          enabled: job.enabled,
          notifyMode: job.notifyMode,
          nextRunAt: job.nextRunAt?.toISOString(),
          lastRunAt: job.lastRunAt?.toISOString(),
          isDefault: false,
        })),
      ],
    });
  } catch (error) {
    console.error("[API] Error fetching scheduled jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled jobs" },
      { status: 500 }
    );
  }
}

function formatCooldown(minutes: number): string {
  if (minutes >= 10080) return `${Math.floor(minutes / 10080)} week`;
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)} day`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} hour`;
  return `${minutes} min`;
}
