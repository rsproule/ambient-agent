/**
 * Scheduled Jobs API
 *
 * List user's scheduled jobs
 */

import { getScheduledJobsForUser } from "@/src/db/scheduledJob";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/connections/scheduled-jobs?userId=xxx
 *
 * Get user's scheduled jobs
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const jobs = await getScheduledJobsForUser(userId);

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        prompt: job.prompt,
        cronSchedule: job.cronSchedule,
        enabled: job.enabled,
        notifyMode: job.notifyMode,
        nextRunAt: job.nextRunAt?.toISOString(),
        lastRunAt: job.lastRunAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching scheduled jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled jobs" },
      { status: 500 },
    );
  }
}

