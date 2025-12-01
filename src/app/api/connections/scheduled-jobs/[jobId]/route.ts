/**
 * Scheduled Job Delete API
 *
 * Delete a specific scheduled job
 */

import { deleteScheduledJob, getScheduledJob } from "@/src/db/scheduledJob";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/connections/scheduled-jobs/[jobId]
 *
 * Delete a scheduled job
 *
 * Body:
 * {
 *   "userId": "xxx"  // For verification
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // Verify job exists and belongs to user
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

    await deleteScheduledJob(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting scheduled job:", error);
    return NextResponse.json(
      { error: "Failed to delete scheduled job" },
      { status: 500 },
    );
  }
}

