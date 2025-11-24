import { NextRequest, NextResponse } from "next/server";
import { getEvaluationsForMessage } from "@/src/db/prioritization";

/**
 * GET /api/prioritization/evaluations/[messageId]
 * Get all evaluations for a queued message
 * 
 * This is useful for multi-recipient messages (global/segment)
 * where one message has multiple evaluations across different conversations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } },
) {
  try {
    const messageId = params.messageId;

    if (!messageId) {
      return NextResponse.json(
        { error: "messageId is required" },
        { status: 400 },
      );
    }

    const evaluations = await getEvaluationsForMessage(messageId);

    if (evaluations.length === 0) {
      return NextResponse.json(
        {
          error: "No evaluations found",
          message: `No evaluations found for message: ${messageId}`,
        },
        { status: 404 },
      );
    }

    // Calculate summary statistics
    const stats = {
      total: evaluations.length,
      passed: evaluations.filter((e) => e.passed).length,
      failed: evaluations.filter((e) => !e.passed).length,
      averageTotalValue:
        evaluations.reduce((sum, e) => sum + e.totalValue, 0) /
        evaluations.length,
      averageBaseValue:
        evaluations.reduce((sum, e) => sum + e.baseValue, 0) /
        evaluations.length,
      totalBribeAmount: evaluations.reduce(
        (sum, e) => sum + e.bribeAmount,
        0,
      ),
    };

    return NextResponse.json({
      success: true,
      messageId,
      evaluations,
      stats,
    });
  } catch (error) {
    console.error("Error getting evaluations:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

