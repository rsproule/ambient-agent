import prisma from "@/src/db/client";
import { getTreasuryBalance } from "@/src/lib/blockchain/usdc";
import { NextRequest, NextResponse } from "next/server";

export interface LeaderboardEntry {
  rank: number;
  amount: string;
  displayName: string | null;
  date: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalPayouts: number;
  totalAmount: string;
  treasuryBalance: string | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  // Validate limit
  if (isNaN(limit) || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: "Invalid limit. Must be between 1 and 100." },
      { status: 400 },
    );
  }

  try {
    // Get completed payouts ordered by amount (descending)
    const payouts = await prisma.payout.findMany({
      where: {
        status: "completed",
      },
      orderBy: {
        amount: "desc",
      },
      take: limit,
    });

    // Get user names for the payouts
    const userIds = payouts.map((p) => p.userId);
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Build leaderboard entries
    const entries: LeaderboardEntry[] = payouts.map((payout, index) => ({
      rank: index + 1,
      amount: payout.amount.toString(),
      displayName: userMap.get(payout.userId) || null,
      date: payout.completedAt?.toISOString() || payout.createdAt.toISOString(),
    }));

    // Get totals
    const totals = await prisma.payout.aggregate({
      where: {
        status: "completed",
      },
      _count: true,
      _sum: {
        amount: true,
      },
    });

    // Get treasury balance (remaining funds)
    const treasuryBalance = await getTreasuryBalance();

    const response: LeaderboardResponse = {
      entries,
      totalPayouts: totals._count,
      totalAmount: totals._sum.amount?.toString() || "0",
      treasuryBalance: treasuryBalance?.formatted || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 },
    );
  }
}
