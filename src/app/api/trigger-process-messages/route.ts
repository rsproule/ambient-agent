import type { processMessages } from "@/src/trigger/tasks/processMessages";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/trigger-process-messages
 *
 * Manually trigger message processing from the queue.
 * Protected by CRON_SECRET.
 *
 * Body (optional):
 * {
 *   "batchSize": 50  // Number of messages to process (default: 10)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[API] Unauthorized POST request to trigger-process-messages");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const batchSize = body.batchSize || 10;

    console.log(
      `[API] Triggering message processing (batch size: ${batchSize})`,
    );

    // Trigger the processMessages task
    const handle = await tasks.trigger<typeof processMessages>(
      "process-messages",
      {
        batchSize,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Message processing triggered",
      taskId: handle.id,
      batchSize,
    });
  } catch (error) {
    console.error("[API] Error triggering message processing:", error);
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
 * GET /api/trigger-process-messages
 *
 * Cron endpoint - processes messages from the queue
 * Protected by CRON_SECRET for Vercel cron jobs
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[API] Unauthorized cron request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[API] Cron triggered: processing messages");

    const handle = await tasks.trigger<typeof processMessages>(
      "process-messages",
      {
        batchSize: 10,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Message processing triggered by cron",
      taskId: handle.id,
    });
  } catch (error) {
    console.error("[API] Error triggering message processing:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
