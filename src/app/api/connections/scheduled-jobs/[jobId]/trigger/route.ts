/**
 * Trigger Scheduled Job API
 *
 * Manually trigger a scheduled job to run now
 */

import { getScheduledJob } from "@/src/db/scheduledJob";
import { auth } from "@/src/lib/auth/config";
import { runScheduledJob } from "@/src/trigger/tasks/runScheduledJob";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/connections/scheduled-jobs/[jobId]/trigger
 *
 * Manually trigger a scheduled job to run immediately
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  // Get authenticated user
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Get the job and verify ownership
    const job = await getScheduledJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Trigger the job
    const handle = await runScheduledJob.trigger({ jobId });

    return NextResponse.json({
      success: true,
      message: `Job "${job.name}" triggered`,
      runId: handle.id,
    });
  } catch (error) {
    console.error("[API] Error triggering scheduled job:", error);
    return NextResponse.json(
      { error: "Failed to trigger scheduled job" },
      { status: 500 },
    );
  }
}
