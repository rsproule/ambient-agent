import prisma from "@/src/db/client";
import { getMessageById } from "@/src/db/messageQueue";
import { getEvaluationsForMessage } from "@/src/db/prioritization";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/message/[messageId]/status
 * Get the delivery status of a queued message
 *
 * Returns:
 * - Message status (pending, processing, completed, failed)
 * - Evaluation results for each recipient
 * - Forwarding status (whether the message was delivered to each user)
 * - Rejection reasons (if any)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;

    if (!messageId) {
      return NextResponse.json(
        { error: "messageId is required" },
        { status: 400 },
      );
    }

    // Get the queued message
    const message = await getMessageById(messageId);

    if (!message) {
      return NextResponse.json(
        {
          error: "Message not found",
          details: `No message found with ID: ${messageId}`,
        },
        { status: 404 },
      );
    }

    // Get all evaluations for this message
    const evaluations = await getEvaluationsForMessage(messageId);

    // Get forwarding status for each conversation
    // System messages with role="system" and sender matching the source
    const conversationIds = evaluations.map((e) => e.conversationId);
    
    // First get the conversation internal IDs
    const conversations = await prisma.conversation.findMany({
      where: {
        conversationId: { in: conversationIds },
      },
      select: {
        id: true,
        conversationId: true,
      },
    });
    
    const conversationInternalIds = conversations.map((c) => c.id);
    
    const forwardingData = await prisma.message.findMany({
      where: {
        role: "system",
        sender: message.source,
        conversationId: {
          in: conversationInternalIds,
        },
      },
      include: {
        conversation: {
          select: {
            conversationId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Create a map of conversationId (phone/group) -> forwarding status
    const forwardingMap = new Map(
      forwardingData.map((f) => [
        f.conversation.conversationId,
        {
          forwarded: f.forwarded,
          rejectionReason: f.rejectionReason,
          createdAt: f.createdAt,
        },
      ]),
    );

    // Build delivery status for each recipient
    const deliveryStatus = evaluations.map((evaluation) => {
      const forwardInfo = forwardingMap.get(evaluation.conversationId);
      return {
        conversationId: evaluation.conversationId,
        evaluationPassed: evaluation.passed,
        totalValue: evaluation.totalValue,
        baseValue: evaluation.baseValue,
        bribeAmount: evaluation.bribeAmount,
        evaluationReason: evaluation.evaluationReason,
        forwarded: forwardInfo?.forwarded ?? null,
        rejectionReason: forwardInfo?.rejectionReason ?? null,
        deliveredAt: forwardInfo?.createdAt ?? null,
      };
    });

    // Calculate summary statistics
    const stats = {
      totalRecipients: evaluations.length,
      passed: evaluations.filter((e) => e.passed).length,
      failed: evaluations.filter((e) => !e.passed).length,
      averageValue:
        evaluations.length > 0
          ? evaluations.reduce((sum, e) => sum + e.totalValue, 0) /
            evaluations.length
          : 0,
    };

    return NextResponse.json({
      success: true,
      messageId,
      status: message.status,
      source: message.source,
      target: message.target,
      processedAt: message.processedAt,
      error: message.error,
      createdAt: message.createdAt,
      deliveryStatus,
      stats,
    });
  } catch (error) {
    console.error("Error getting message status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

