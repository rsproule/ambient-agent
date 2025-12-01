/**
 * Scheduled Job API
 *
 * Delete or update a specific scheduled job
 */

import {
  deleteScheduledJob,
  getScheduledJob,
  updateScheduledJob,
} from "@/src/db/scheduledJob";
import { auth } from "@/src/lib/auth/config";
import { NextRequest, NextResponse } from "next/server";

/**
 * PUT /api/connections/scheduled-jobs/[jobId]
 *
 * Update a scheduled job
 *
 * Body:
 * {
 *   "name"?: "string",
 *   "prompt"?: "string",
 *   "cronSchedule"?: "string",
 *   "notifyMode"?: "always" | "significant"
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { jobId } = await params;
    const body = await request.json();
    const { name, prompt, cronSchedule, notifyMode } = body;

    // Verify job exists and belongs to authenticated user
    const job = await getScheduledJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Build update object with only provided fields
    const updates: {
      name?: string;
      prompt?: string;
      cronSchedule?: string;
      notifyMode?: "always" | "significant";
    } = {};

    if (name !== undefined) updates.name = name;
    if (prompt !== undefined) updates.prompt = prompt;
    if (cronSchedule !== undefined) updates.cronSchedule = cronSchedule;
    if (notifyMode !== undefined) updates.notifyMode = notifyMode;

    const updatedJob = await updateScheduledJob(jobId, updates);

    return NextResponse.json({ job: updatedJob });
  } catch (error) {
    console.error("[API] Error updating scheduled job:", error);
    return NextResponse.json(
      { error: "Failed to update scheduled job" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections/scheduled-jobs/[jobId]
 *
 * Delete a scheduled job
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { jobId } = await params;

    // Verify job exists and belongs to authenticated user
    const job = await getScheduledJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await deleteScheduledJob(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting scheduled job:", error);
    return NextResponse.json(
      { error: "Failed to delete scheduled job" },
      { status: 500 }
    );
  }
}
