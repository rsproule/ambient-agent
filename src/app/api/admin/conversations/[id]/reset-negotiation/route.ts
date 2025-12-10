import prisma from "@/src/db/client";
import { requireAdmin } from "@/src/lib/auth/admin";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/conversations/[id]/reset-negotiation
 * Reset a user's negotiation state so they can negotiate again
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Admin check
  const adminCheck = await requireAdmin();
  if (!adminCheck.authorized) {
    return (
      adminCheck.error ||
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  const { id: conversationId } = await params;

  try {
    // Get the conversation to find the user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        conversationId: true,
        isGroup: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    if (conversation.isGroup) {
      return NextResponse.json(
        { error: "Cannot reset negotiation for group chats" },
        { status: 400 },
      );
    }

    // For DMs, conversationId is the phone number
    const phoneNumber = conversation.conversationId;

    // Find the user by phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
      select: { id: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found for this conversation" },
        { status: 404 },
      );
    }

    // Delete all related records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete payout records
      const deletedPayouts = await tx.payout.deleteMany({
        where: { userId: user.id },
      });

      // 2. Delete negotiation offers
      const deletedOffers = await tx.negotiationOffer.deleteMany({
        where: { userId: user.id },
      });

      // 3. Delete negotiation app state
      const deletedApps = await tx.negotiationApp.deleteMany({
        where: { conversationId: conversation.conversationId },
      });

      // 4. Reset user's onboarding status
      await tx.user.update({
        where: { id: user.id },
        data: { hasCompletedOnboarding: false },
      });

      return {
        deletedPayouts: deletedPayouts.count,
        deletedOffers: deletedOffers.count,
        deletedApps: deletedApps.count,
      };
    });

    console.log(
      `[Admin] Reset negotiation for user ${user.id} (${phoneNumber}):`,
      result,
    );

    return NextResponse.json({
      success: true,
      message: "Negotiation reset successfully",
      userId: user.id,
      userName: user.name,
      ...result,
    });
  } catch (error) {
    console.error("Error resetting negotiation:", error);
    return NextResponse.json(
      {
        error: "Failed to reset negotiation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
