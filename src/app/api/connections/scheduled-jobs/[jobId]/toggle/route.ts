/**
 * Toggle Scheduled Job API
 *
 * Enable or disable a specific scheduled job (default or user-created)
 */

import prisma from "@/src/db/client";
import { getScheduledJob, setScheduledJobEnabled } from "@/src/db/scheduledJob";
import { DEFAULT_HOOK_SCHEDULES, type HookName } from "@/src/lib/proactive/types";
import type { Prisma } from "@/src/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/connections/scheduled-jobs/[jobId]/toggle
 *
 * Toggle a scheduled job's enabled state
 *
 * Body:
 * {
 *   "userId": "xxx",
 *   "enabled": true/false
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const body = await request.json();
    const { userId, enabled } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 },
      );
    }

    // Check if this is a default job (format: "default:hookId")
    if (jobId.startsWith("default:")) {
      const hookId = jobId.replace("default:", "") as HookName;
      
      // Get current hook cooldowns
      const userContext = await prisma.userContext.findUnique({
        where: { userId },
      });
      
      const currentCooldowns = (userContext?.hookCooldowns as Record<string, number>) || {};
      const defaultCooldown = DEFAULT_HOOK_SCHEDULES[hookId] || 60;
      
      // Update: 0 = disabled, otherwise use current or default cooldown
      const newCooldowns: Record<string, number> = {
        ...currentCooldowns,
        [hookId]: enabled ? (currentCooldowns[hookId] || defaultCooldown) : 0,
      };
      
      // If disabling, make sure we set to 0; if enabling, restore to default if was 0
      if (enabled && currentCooldowns[hookId] === 0) {
        newCooldowns[hookId] = defaultCooldown;
      }

      await prisma.userContext.upsert({
        where: { userId },
        create: {
          userId,
          hookCooldowns: newCooldowns as Prisma.InputJsonValue,
        },
        update: {
          hookCooldowns: newCooldowns as Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({ success: true, enabled, isDefault: true });
    }

    // User-created job
    const job = await getScheduledJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 },
      );
    }

    if (job.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
    }

    await setScheduledJobEnabled(jobId, enabled);

    return NextResponse.json({ success: true, enabled, isDefault: false });
  } catch (error) {
    console.error("[API] Error toggling scheduled job:", error);
    return NextResponse.json(
      { error: "Failed to toggle scheduled job" },
      { status: 500 },
    );
  }
}

