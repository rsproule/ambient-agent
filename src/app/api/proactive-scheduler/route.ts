/**
 * Proactive Scheduler API Route
 *
 * Cron endpoint that triggers the proactive notification scheduler.
 * Protected by CRON_SECRET for Vercel cron jobs.
 */

import type { proactiveScheduler } from "@/src/trigger/tasks/proactiveScheduler";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/proactive-scheduler
 *
 * Cron endpoint - triggers the proactive notification scheduler
 * Protected by CRON_SECRET for Vercel cron jobs
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[API] Unauthorized cron request to proactive-scheduler");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[API] Cron triggered: starting proactive scheduler");

    const handle = await tasks.trigger<typeof proactiveScheduler>(
      "proactive-scheduler",
      {},
    );

    return NextResponse.json({
      success: true,
      message: "Proactive scheduler triggered by cron",
      taskId: handle.id,
    });
  } catch (error) {
    console.error("[API] Error triggering proactive scheduler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/proactive-scheduler
 *
 * Manual trigger endpoint for testing
 * Protected by CRON_SECRET
 *
 * Body (optional):
 * {
 *   "userIds": ["user-id-1", "user-id-2"]  // Optional: limit to specific users
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[API] Unauthorized POST request to proactive-scheduler");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const userIds = body.userIds as string[] | undefined;

    console.log(
      `[API] Manual proactive scheduler trigger${
        userIds ? ` for ${userIds.length} users` : ""
      }`,
    );

    const handle = await tasks.trigger<typeof proactiveScheduler>(
      "proactive-scheduler",
      {
        userIds,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Proactive scheduler triggered manually",
      taskId: handle.id,
      userIds: userIds || "*",
    });
  } catch (error) {
    console.error("[API] Error triggering proactive scheduler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
