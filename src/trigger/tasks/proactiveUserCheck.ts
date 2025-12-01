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
  checkGitHub,
  checkGmail,
  checkScheduledJobs,
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
 */
async function updateHookLastRunTime(
  userId: string,
  hookName: HookName,
  existingTimes: HookLastRunTimes,
): Promise<void> {
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

    // Determine which hooks are due
    const dueHooks: HookName[] = [];
    const skippedHooks: HookName[] = [];

    const allHooks: HookName[] = [
      "scheduledJobs",
      "calendar",
      "github",
      "gmail",
      "connectionReminder",
    ];

    for (const hookName of allHooks) {
      if (isHookDue(hookName, lastRunTimes, schedules)) {
        dueHooks.push(hookName);
      } else {
        skippedHooks.push(hookName);
      }
    }

    console.log(
      `[ProactiveUserCheck] User ${userId}: Due hooks: [${dueHooks.join(
        ", ",
      )}], Skipped: [${skippedHooks.join(", ")}]`,
    );

    if (dueHooks.length === 0) {
      return {
        success: true,
        notified: false,
        reason: "no_hooks_due",
        skippedHooks,
      };
    }

    // Run only the due hooks (in priority order)
    const hookResults: Array<{ name: HookName; result: HookResult }> = [];

    // 1. Scheduled jobs (highest priority - user explicitly requested these)
    if (dueHooks.includes("scheduledJobs")) {
      try {
        const result = await checkScheduledJobs(context);
        hookResults.push({ name: "scheduledJobs", result });
        // Always update last run time, even if no notification
        await updateHookLastRunTime(userId, "scheduledJobs", lastRunTimes);
      } catch (error) {
        console.error(`[ProactiveUserCheck] scheduledJobs hook error:`, error);
      }
    }

    // 2. Calendar (time-sensitive)
    if (dueHooks.includes("calendar")) {
      try {
        const result = await checkCalendar(
          context,
          DEFAULT_HOOK_CONFIG.calendarReminderMinutes,
        );
        hookResults.push({ name: "calendar", result });
        await updateHookLastRunTime(userId, "calendar", lastRunTimes);
      } catch (error) {
        console.error(`[ProactiveUserCheck] calendar hook error:`, error);
      }
    }

    // 3. GitHub (PR reviews can be urgent)
    if (dueHooks.includes("github")) {
      try {
        const result = await checkGitHub(context);
        hookResults.push({ name: "github", result });
        await updateHookLastRunTime(userId, "github", lastRunTimes);
      } catch (error) {
        console.error(`[ProactiveUserCheck] github hook error:`, error);
      }
    }

    // 4. Gmail (important emails)
    if (dueHooks.includes("gmail")) {
      try {
        const result = await checkGmail(context);
        hookResults.push({ name: "gmail", result });
        await updateHookLastRunTime(userId, "gmail", lastRunTimes);
      } catch (error) {
        console.error(`[ProactiveUserCheck] gmail hook error:`, error);
      }
    }

    // 5. Connection reminder (low priority)
    if (dueHooks.includes("connectionReminder")) {
      try {
        const result = await checkConnectionReminder(context, 7); // 7 days between reminders
        hookResults.push({ name: "connectionReminder", result });
        await updateHookLastRunTime(userId, "connectionReminder", lastRunTimes);
      } catch (error) {
        console.error(
          `[ProactiveUserCheck] connectionReminder hook error:`,
          error,
        );
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
