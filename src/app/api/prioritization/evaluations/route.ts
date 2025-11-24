import { NextRequest, NextResponse } from "next/server";
import {
  getEvaluationsForConversation,
  getEvaluationStats,
} from "@/src/db/prioritization";

/**
 * GET /api/prioritization/evaluations?conversationId=xxx&limit=50
 * Get evaluations for a specific conversation
 * 
 * This is useful for analytics and understanding what messages
 * were evaluated for a specific user/conversation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get("conversationId");
    const limitParam = searchParams.get("limit");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId query parameter is required" },
        { status: 400 },
      );
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    if (isNaN(limit) || limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: "limit must be between 1 and 500" },
        { status: 400 },
      );
    }

    // Get evaluations and stats in parallel
    const [evaluations, stats] = await Promise.all([
      getEvaluationsForConversation(conversationId, limit),
      getEvaluationStats(conversationId),
    ]);

    return NextResponse.json({
      success: true,
      conversationId,
      evaluations,
      stats,
      meta: {
        returned: evaluations.length,
        limit,
      },
    });
  } catch (error) {
    console.error("Error getting conversation evaluations:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

