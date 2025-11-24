import type { processMessages } from "@/src/trigger/tasks/processMessages";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/trigger-process-messages
 *
 * Manually trigger message processing from the queue.
 * Useful for immediate processing when new messages are enqueued.
 *
 * Body (optional):
 * {
 *   "batchSize": 50  // Number of messages to process (default: 10)
 * }
 */
export async function POST(request: NextRequest) {
  try {
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
 * Check status - just trigger a small batch
 */
export async function GET() {
  try {
    const handle = await tasks.trigger<typeof processMessages>(
      "process-messages",
      {
        batchSize: 10,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Message processing triggered",
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
