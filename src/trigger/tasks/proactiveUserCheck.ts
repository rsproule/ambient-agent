/**
 * Proactive User Check Task
 *
 * Runs proactive hooks for a single user based on individual hook schedules.
 * Each hook has its own cooldown - we only run hooks that are "due".
 */

import prisma from "@/src/db/client";
import { getUserConnections } from "@/src/db/connection";
import { saveSystemMessage } from "@/src/db/conversation";
import { getPhoneNumberForUser } from "@/src/db/user";
import { getUserContext } from "@/src/db/userContext";
import type { Prisma } from "@/src/generated/prisma";
import {
  checkCalendar,
  checkConnectionReminder,
  checkDeepResearch,
  checkGitHub,
  checkGmail,
  checkScheduledJobs,
  checkTwitter,
} from "@/src/lib/proactive/hooks";
import {
  DEFAULT_HOOK_CONFIG,
  DEFAULT_HOOK_SCHEDULES,
  type HookContext,
  type HookName,
  type HookResult,
  type HookScheduleConfig,
} from "@/src/lib/proactive/types";
import { task } from "@trigger.dev/sdk/v3";
import { debouncedResponse } from "./debouncedResponse";

type ProactiveUserCheckPayload = {
  userId: string;
};

type HookLastRunTimes = Partial<Record<HookName, string>>; // ISO date strings
type HookCooldowns = Partial<Record<HookName, number>>; // minutes

/**
 * Hook definition for dynamic dispatch
 */
interface HookDefinition {
  name: HookName;
  /** Lower number = higher priority (runs first) */
  priority: number;
  /** Execute the hook */
  execute: (context: HookContext) => Promise<HookResult>;
}

/**
 * Registry of all proactive hooks
 * Sorted by priority (lower = runs first)
 */
const HOOK_REGISTRY: HookDefinition[] = (
  [
    {
      name: "scheduledJobs" as const,
      priority: 1, // Highest - user explicitly requested these
      execute: checkScheduledJobs,
    },
    {
      name: "calendar" as const,
      priority: 2, // Time-sensitive
      execute: (ctx: HookContext) =>
        checkCalendar(ctx, DEFAULT_HOOK_CONFIG.calendarReminderMinutes),
    },
    {
      name: "github" as const,
      priority: 3, // PR reviews can be urgent
      execute: checkGitHub,
    },
    {
      name: "gmail" as const,
      priority: 4, // Important emails
      execute: checkGmail,
    },
    {
      name: "twitter" as const,
      priority: 5, // Social feed - interesting but not urgent
      execute: checkTwitter,
    },
    {
      name: "connectionReminder" as const,
      priority: 6, // Low priority
      execute: (ctx: HookContext) => checkConnectionReminder(ctx, 7), // 7 days between reminders
    },
    {
      name: "deepResearch" as const,
      priority: 7, // Background task, lowest priority
      execute: checkDeepResearch,
    },
  ] satisfies HookDefinition[]
).sort((a, b) => a.priority - b.priority);

/**
 * Build the hook context for a user
 */
async function buildHookContext(userId: string): Promise<HookContext | null> {
  // Get user's phone number
  const phoneNumber = await getPhoneNumberForUser(userId);
  if (!phoneNumber) {
    return null;
  }

  // Get user context
  const userContext = await getUserContext(userId);
  const timezone = userContext?.timezone || "America/Los_Angeles";

  // Get user's connections
  const connections = await getUserConnections(userId);
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

  // Get recent messages for deduplication
  const conversation = await prisma.conversation.findUnique({
    where: { conversationId: phoneNumber },
    include: {
      messages: {
        where: {
          role: "system",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  const recentMessages = (conversation?.messages || []).map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    createdAt: m.createdAt,
  }));

  return {
    userId,
    phoneNumber,
    timezone,
    recentMessages,
    connections: {
      gmail: gmailConnected,
      github: githubConnected,
      calendar: calendarConnected,
      twitter: twitterConnected,
    },
  };
}

/**
 * Check if a hook is due to run based on its schedule
 * Returns false if hook is disabled (cooldown = 0)
 */
function isHookDue(
  hookName: HookName,
  lastRunTimes: HookLastRunTimes,
  schedules: HookScheduleConfig,
): boolean {
  const cooldownMinutes = schedules[hookName];

  // Cooldown of 0 means disabled
  if (cooldownMinutes === 0) {
    return false;
  }

  const lastRunStr = lastRunTimes[hookName];

  // If never run, it's due
  if (!lastRunStr) {
    return true;
  }

  const lastRun = new Date(lastRunStr);
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const timeSinceLastRun = Date.now() - lastRun.getTime();

  return timeSinceLastRun >= cooldownMs;
}

/**
 * Get effective schedules (merge defaults with user overrides)
 */
function getEffectiveSchedules(
  userOverrides: HookCooldowns | null,
): HookScheduleConfig {
  if (!userOverrides) {
    return DEFAULT_HOOK_SCHEDULES;
  }

  return {
    ...DEFAULT_HOOK_SCHEDULES,
    ...userOverrides,
  };
}

/**
 * Update the last run time for a hook
 * Returns the updated times object so callers can accumulate changes
 */
async function updateHookLastRunTime(
  userId: string,
  hookName: HookName,
  existingTimes: HookLastRunTimes,
): Promise<HookLastRunTimes> {
  const updatedTimes: HookLastRunTimes = {
    ...existingTimes,
    [hookName]: new Date().toISOString(),
  };

  await prisma.userContext.update({
    where: { userId },
    data: {
      hookLastRunTimes: updatedTimes as Prisma.InputJsonValue,
    },
  });

  return updatedTimes;
}

/**
 * Run all proactive hooks for a user (only those that are due)
 */
export const proactiveUserCheck = task({
  id: "proactive-user-check",
  machine: {
    preset: "small-1x",
  },
  run: async (payload: ProactiveUserCheckPayload) => {
    const { userId } = payload;

    console.log(`[ProactiveUserCheck] Checking user ${userId}`);

    // Build hook context
    const context = await buildHookContext(userId);
    if (!context) {
      console.log(
        `[ProactiveUserCheck] Could not build context for user ${userId}`,
      );
      return { success: false, reason: "no_context" };
    }

    // Get user's hook settings
    const rawContext = await prisma.userContext.findUnique({
      where: { userId },
    });

    const lastRunTimes =
      (rawContext?.hookLastRunTimes as HookLastRunTimes) || {};
    const userCooldowns = (rawContext?.hookCooldowns as HookCooldowns) || null;
    const schedules = getEffectiveSchedules(userCooldowns);

    // Determine which hooks are due (using the registry)
    const dueHooks = HOOK_REGISTRY.filter((hook) =>
      isHookDue(hook.name, lastRunTimes, schedules),
    );
    const skippedHooks = HOOK_REGISTRY.filter(
      (hook) => !isHookDue(hook.name, lastRunTimes, schedules),
    ).map((h) => h.name);

    console.log(
      `[ProactiveUserCheck] User ${userId}: Due hooks: [${dueHooks
        .map((h) => h.name)
        .join(", ")}], Skipped: [${skippedHooks.join(", ")}]`,
    );

    if (dueHooks.length === 0) {
      return {
        success: true,
        notified: false,
        reason: "no_hooks_due",
        skippedHooks,
      };
    }

    // Run all due hooks via dynamic dispatch (already sorted by priority)
    const hookResults: Array<{ name: HookName; result: HookResult }> = [];
    let currentLastRunTimes = lastRunTimes;

    for (const hook of dueHooks) {
      try {
        const result = await hook.execute(context);
        hookResults.push({ name: hook.name, result });
        // Always update last run time, even if no notification
        // Accumulate updates so each write includes previous hooks' times
        currentLastRunTimes = await updateHookLastRunTime(
          userId,
          hook.name,
          currentLastRunTimes,
        );
      } catch (error) {
        console.error(`[ProactiveUserCheck] ${hook.name} hook error:`, error);
      }
    }

    // Find the first hook that wants to notify
    const notifyingHook = hookResults.find((h) => h.result.shouldNotify);

    if (!notifyingHook || !notifyingHook.result.message) {
      console.log(`[ProactiveUserCheck] No notifications for user ${userId}`);
      return {
        success: true,
        notified: false,
        hooksRun: hookResults.map((h) => h.name),
        skippedHooks,
      };
    }

    console.log(
      `[ProactiveUserCheck] Notifying user ${userId} via hook: ${notifyingHook.name}`,
    );

    // Save the system message
    await saveSystemMessage(
      context.phoneNumber,
      notifyingHook.result.message,
      `proactive:${notifyingHook.name}`,
      false,
    );

    // Trigger Whiskers to respond
    await debouncedResponse.trigger({
      conversationId: context.phoneNumber,
      recipient: context.phoneNumber,
      timestampWhenTriggered: new Date().toISOString(),
    });

    return {
      success: true,
      notified: true,
      hook: notifyingHook.name,
      hooksRun: hookResults.map((h) => h.name),
      skippedHooks,
    };
  },
});
