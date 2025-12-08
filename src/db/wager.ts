/**
 * Database operations for Wagers
 *
 * Handles CRUD operations for group chat wagering/betting markets.
 * Supports multi-participant positions with matching.
 */

import prisma from "@/src/db/client";
import type {
  VerificationType as PrismaVerificationType,
  WagerStatus as PrismaWagerStatus,
  Prisma,
} from "@/src/generated/prisma";
import { Decimal } from "@/src/generated/prisma/runtime/library";

// ============================================
// Types
// ============================================

export type WagerStatus = PrismaWagerStatus;
export type VerificationType = PrismaVerificationType;

export interface Wager {
  id: string;
  conversationId: string;
  creatorPhone: string;
  title: string;
  condition: string;
  sides: string[];
  verificationType: VerificationType;
  verificationConfig: unknown | null;
  status: WagerStatus;
  deadline: Date | null;
  result: string | null;
  resolvedAt: Date | null;
  proofUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WagerPosition {
  id: string;
  wagerId: string;
  phone: string;
  side: string;
  amount: number;
  matchedAmount: number;
  createdAt: Date;
}

export interface WagerWithPositions extends Wager {
  positions: WagerPosition[];
}

export interface CreateWagerInput {
  conversationId: string;
  creatorPhone: string;
  title: string;
  condition: string;
  sides?: string[];
  verificationType: VerificationType;
  verificationConfig?: unknown;
  deadline?: Date;
}

export interface PlacePositionInput {
  wagerId: string;
  phone: string;
  side: string;
  amount: number;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new wager (market)
 */
export async function createWager(input: CreateWagerInput): Promise<Wager> {
  const wager = await prisma.wager.create({
    data: {
      conversationId: input.conversationId,
      creatorPhone: input.creatorPhone,
      title: input.title,
      condition: input.condition,
      sides: input.sides || ["YES", "NO"],
      verificationType: input.verificationType,
      verificationConfig: input.verificationConfig as Prisma.InputJsonValue,
      deadline: input.deadline,
      status: "open",
    },
  });

  return formatWager(wager);
}

/**
 * Get a wager by ID
 */
export async function getWager(wagerId: string): Promise<Wager | null> {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
  });

  return wager ? formatWager(wager) : null;
}

/**
 * Get a wager with all positions
 */
export async function getWagerWithPositions(
  wagerId: string,
): Promise<WagerWithPositions | null> {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { positions: true },
  });

  if (!wager) return null;

  return {
    ...formatWager(wager),
    positions: wager.positions.map(formatPosition),
  };
}

/**
 * Get all wagers for a group chat
 */
export async function getWagersForGroup(
  conversationId: string,
  options?: {
    status?: WagerStatus | WagerStatus[];
    includePositions?: boolean;
  },
): Promise<WagerWithPositions[]> {
  const statusFilter = options?.status
    ? Array.isArray(options.status)
      ? { in: options.status }
      : options.status
    : undefined;

  const wagers = await prisma.wager.findMany({
    where: {
      conversationId,
      ...(statusFilter && { status: statusFilter }),
    },
    include: { positions: options?.includePositions ?? true },
    orderBy: { createdAt: "desc" },
  });

  return wagers.map((w) => ({
    ...formatWager(w),
    positions: w.positions.map(formatPosition),
  }));
}

/**
 * Get active wagers (open or active) for a group
 */
export async function getActiveWagersForGroup(
  conversationId: string,
): Promise<WagerWithPositions[]> {
  return getWagersForGroup(conversationId, {
    status: ["open", "active"],
    includePositions: true,
  });
}

/**
 * Place a position (bet) on a wager
 * Automatically matches against opposite side positions
 */
export async function placePosition(
  input: PlacePositionInput,
): Promise<{ position: WagerPosition; wager: WagerWithPositions }> {
  const { wagerId, phone, side, amount } = input;

  // Get the wager with positions
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { positions: true },
  });

  if (!wager) {
    throw new Error("Wager not found");
  }

  if (!["open", "active"].includes(wager.status)) {
    throw new Error(`Cannot place position on wager with status: ${wager.status}`);
  }

  if (!wager.sides.includes(side)) {
    throw new Error(`Invalid side: ${side}. Valid sides: ${wager.sides.join(", ")}`);
  }

  // Create the position
  const position = await prisma.wagerPosition.create({
    data: {
      wagerId,
      phone,
      side,
      amount: new Decimal(amount),
      matchedAmount: new Decimal(0),
    },
  });

  // Match against opposite side positions
  await matchPositions(wagerId);

  // Get updated wager
  const updatedWager = await getWagerWithPositions(wagerId);
  if (!updatedWager) {
    throw new Error("Failed to get updated wager");
  }

  return {
    position: formatPosition(position),
    wager: updatedWager,
  };
}

/**
 * Match positions on a wager
 * Called after a new position is placed
 */
async function matchPositions(wagerId: string): Promise<void> {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { positions: true },
  });

  if (!wager || wager.sides.length !== 2) return;

  const [side1, side2] = wager.sides;

  // Get unmatched amounts for each side
  const side1Positions = wager.positions.filter((p) => p.side === side1);
  const side2Positions = wager.positions.filter((p) => p.side === side2);

  const side1Unmatched = side1Positions.reduce(
    (sum, p) => sum.plus(p.amount.minus(p.matchedAmount)),
    new Decimal(0),
  );
  const side2Unmatched = side2Positions.reduce(
    (sum, p) => sum.plus(p.amount.minus(p.matchedAmount)),
    new Decimal(0),
  );

  // Match up to the minimum of unmatched amounts
  const matchAmount = Decimal.min(side1Unmatched, side2Unmatched);

  if (matchAmount.lte(0)) return;

  // Distribute matching to positions (FIFO - oldest first)
  let remaining = matchAmount;

  // Match side1 positions
  for (const pos of side1Positions.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )) {
    if (remaining.lte(0)) break;

    const posUnmatched = pos.amount.minus(pos.matchedAmount);
    if (posUnmatched.lte(0)) continue;

    const toMatch = Decimal.min(posUnmatched, remaining);
    await prisma.wagerPosition.update({
      where: { id: pos.id },
      data: { matchedAmount: pos.matchedAmount.plus(toMatch) },
    });
    remaining = remaining.minus(toMatch);
  }

  // Match side2 positions
  remaining = matchAmount;
  for (const pos of side2Positions.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )) {
    if (remaining.lte(0)) break;

    const posUnmatched = pos.amount.minus(pos.matchedAmount);
    if (posUnmatched.lte(0)) continue;

    const toMatch = Decimal.min(posUnmatched, remaining);
    await prisma.wagerPosition.update({
      where: { id: pos.id },
      data: { matchedAmount: pos.matchedAmount.plus(toMatch) },
    });
    remaining = remaining.minus(toMatch);
  }

  // Update wager status to active if any matching occurred
  if (matchAmount.gt(0) && wager.status === "open") {
    await prisma.wager.update({
      where: { id: wagerId },
      data: { status: "active" },
    });
  }
}

/**
 * Resolve a wager with a winning side
 */
export async function resolveWager(
  wagerId: string,
  winningSide: string,
  proofUrl?: string,
): Promise<WagerWithPositions> {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { positions: true },
  });

  if (!wager) {
    throw new Error("Wager not found");
  }

  if (!["open", "active", "pending_verification"].includes(wager.status)) {
    throw new Error(`Cannot resolve wager with status: ${wager.status}`);
  }

  if (!wager.sides.includes(winningSide)) {
    throw new Error(
      `Invalid winning side: ${winningSide}. Valid sides: ${wager.sides.join(", ")}`,
    );
  }

  const updated = await prisma.wager.update({
    where: { id: wagerId },
    data: {
      status: "resolved",
      result: winningSide,
      resolvedAt: new Date(),
      proofUrl,
    },
    include: { positions: true },
  });

  return {
    ...formatWager(updated),
    positions: updated.positions.map(formatPosition),
  };
}

/**
 * Cancel a wager (only if no matching has occurred)
 */
export async function cancelWager(wagerId: string): Promise<Wager> {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { positions: true },
  });

  if (!wager) {
    throw new Error("Wager not found");
  }

  // Check if any positions have been matched
  const hasMatched = wager.positions.some((p) => p.matchedAmount.gt(0));

  if (hasMatched) {
    throw new Error(
      "Cannot cancel wager with matched positions. Some bets have already been locked in.",
    );
  }

  const updated = await prisma.wager.update({
    where: { id: wagerId },
    data: { status: "cancelled" },
  });

  return formatWager(updated);
}

/**
 * Update wager status to pending_verification (e.g., when deadline passes)
 */
export async function markWagerPendingVerification(
  wagerId: string,
): Promise<Wager> {
  const updated = await prisma.wager.update({
    where: { id: wagerId },
    data: { status: "pending_verification" },
  });

  return formatWager(updated);
}

/**
 * Get summary of a wager for display
 */
export function getWagerSummary(wager: WagerWithPositions): {
  totalPool: number;
  matchedPool: number;
  sideTotals: Record<string, { total: number; matched: number; participants: string[] }>;
} {
  const sideTotals: Record<
    string,
    { total: number; matched: number; participants: string[] }
  > = {};

  for (const side of wager.sides) {
    sideTotals[side] = { total: 0, matched: 0, participants: [] };
  }

  for (const pos of wager.positions) {
    if (!sideTotals[pos.side]) {
      sideTotals[pos.side] = { total: 0, matched: 0, participants: [] };
    }
    sideTotals[pos.side].total += pos.amount;
    sideTotals[pos.side].matched += pos.matchedAmount;
    if (!sideTotals[pos.side].participants.includes(pos.phone)) {
      sideTotals[pos.side].participants.push(pos.phone);
    }
  }

  const totalPool = Object.values(sideTotals).reduce(
    (sum, s) => sum + s.total,
    0,
  );
  const matchedPool = Object.values(sideTotals).reduce(
    (sum, s) => sum + s.matched,
    0,
  );

  return { totalPool, matchedPool, sideTotals };
}

/**
 * Calculate payouts for a resolved wager
 */
export function calculatePayouts(
  wager: WagerWithPositions,
): { phone: string; amount: number }[] {
  if (wager.status !== "resolved" || !wager.result) {
    return [];
  }

  const winningSide = wager.result;
  const losingSide = wager.sides.find((s) => s !== winningSide);

  if (!losingSide) return [];

  // Total matched pool from losing side goes to winning side
  const losingPool = wager.positions
    .filter((p) => p.side === losingSide)
    .reduce((sum, p) => sum + p.matchedAmount, 0);

  const winningPositions = wager.positions.filter(
    (p) => p.side === winningSide && p.matchedAmount > 0,
  );
  const totalWinningMatched = winningPositions.reduce(
    (sum, p) => sum + p.matchedAmount,
    0,
  );

  if (totalWinningMatched === 0) return [];

  // Distribute proportionally
  const payouts: { phone: string; amount: number }[] = [];

  for (const pos of winningPositions) {
    const share = pos.matchedAmount / totalWinningMatched;
    const winnings = losingPool * share;
    // They get back their matched amount plus winnings
    const totalPayout = pos.matchedAmount + winnings;
    payouts.push({ phone: pos.phone, amount: totalPayout });
  }

  // Unmatched amounts go back to their owners
  for (const pos of wager.positions) {
    const unmatched = pos.amount - pos.matchedAmount;
    if (unmatched > 0) {
      const existing = payouts.find((p) => p.phone === pos.phone);
      if (existing) {
        existing.amount += unmatched;
      } else {
        payouts.push({ phone: pos.phone, amount: unmatched });
      }
    }
  }

  return payouts;
}

// ============================================
// Helpers
// ============================================

function formatWager(wager: {
  id: string;
  conversationId: string;
  creatorPhone: string;
  title: string;
  condition: string;
  sides: string[];
  verificationType: PrismaVerificationType;
  verificationConfig: unknown;
  status: PrismaWagerStatus;
  deadline: Date | null;
  result: string | null;
  resolvedAt: Date | null;
  proofUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Wager {
  return {
    id: wager.id,
    conversationId: wager.conversationId,
    creatorPhone: wager.creatorPhone,
    title: wager.title,
    condition: wager.condition,
    sides: wager.sides,
    verificationType: wager.verificationType,
    verificationConfig: wager.verificationConfig,
    status: wager.status,
    deadline: wager.deadline,
    result: wager.result,
    resolvedAt: wager.resolvedAt,
    proofUrl: wager.proofUrl,
    createdAt: wager.createdAt,
    updatedAt: wager.updatedAt,
  };
}

function formatPosition(position: {
  id: string;
  wagerId: string;
  phone: string;
  side: string;
  amount: Decimal;
  matchedAmount: Decimal;
  createdAt: Date;
}): WagerPosition {
  return {
    id: position.id,
    wagerId: position.wagerId,
    phone: position.phone,
    side: position.side,
    amount: position.amount.toNumber(),
    matchedAmount: position.matchedAmount.toNumber(),
    createdAt: position.createdAt,
  };
}
