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
import { NextRequest, NextResponse } from "next/server";

/**
 * PUT /api/connections/scheduled-jobs/[jobId]
 *
 * Update a scheduled job
 *
 * Body:
 * {
 *   "userId": "xxx",  // For verification
 *   "name"?: "string",
 *   "prompt"?: "string",
 *   "cronSchedule"?: "string",
 *   "notifyMode"?: "always" | "significant"
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const body = await request.json();
    const { userId, name, prompt, cronSchedule, notifyMode } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // Verify job exists and belongs to user
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
      { status: 500 },
    );
  }
}

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

