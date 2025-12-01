/**
 * Proactive Scheduler Task
 *
 * Main scheduler that runs on a cron schedule and fans out
 * to individual proactiveUserCheck tasks for each opted-in user.
 */

import prisma from "@/src/db/client";
import { task } from "@trigger.dev/sdk/v3";
import { proactiveUserCheck } from "./proactiveUserCheck";

type ProactiveSchedulerPayload = {
  /** Optional: limit to specific user IDs (for testing) */
  userIds?: string[];
};

/**
 * Get all users who have opted in to outbound messages
 */
async function getOptedInUsers(): Promise<Array<{ id: string; phoneNumber: string | null }>> {
  const users = await prisma.user.findMany({
    where: {
      outboundOptIn: true,
      phoneNumber: { not: null },
    },
    select: {
      id: true,
      phoneNumber: true,
    },
  });

  return users;
}

/**
 * Main scheduler task - fans out to per-user checks
 */
export const proactiveScheduler = task({
  id: "proactive-scheduler",
  machine: {
    preset: "small-1x",
  },
  run: async (payload: ProactiveSchedulerPayload) => {
    console.log("[ProactiveScheduler] Starting proactive check cycle");

    // Get users to check
    let usersToCheck: Array<{ id: string; phoneNumber: string | null }>;

    if (payload.userIds && payload.userIds.length > 0) {
      // Testing mode: only check specific users
      usersToCheck = await prisma.user.findMany({
        where: {
          id: { in: payload.userIds },
          phoneNumber: { not: null },
        },
        select: {
          id: true,
          phoneNumber: true,
        },
      });
      console.log(
        `[ProactiveScheduler] Testing mode: checking ${usersToCheck.length} specific users`,
      );
    } else {
      // Normal mode: check all opted-in users
      usersToCheck = await getOptedInUsers();
      console.log(
        `[ProactiveScheduler] Found ${usersToCheck.length} opted-in users`,
      );
    }

    if (usersToCheck.length === 0) {
      console.log("[ProactiveScheduler] No users to check, exiting");
      return {
        success: true,
        usersChecked: 0,
      };
    }

    // Fan out: trigger a proactiveUserCheck task for each user
    // This allows each user check to run independently and scale horizontally
    const triggerResults = await Promise.allSettled(
      usersToCheck.map((user) =>
        proactiveUserCheck.trigger({
          userId: user.id,
        }),
      ),
    );

    // Count successes and failures
    const succeeded = triggerResults.filter(
      (r) => r.status === "fulfilled",
    ).length;
    const failed = triggerResults.filter(
      (r) => r.status === "rejected",
    ).length;

    console.log(
      `[ProactiveScheduler] Triggered ${succeeded} user checks (${failed} failed to trigger)`,
    );

    return {
      success: true,
      usersChecked: usersToCheck.length,
      triggered: succeeded,
      failedToTrigger: failed,
    };
  },
});

