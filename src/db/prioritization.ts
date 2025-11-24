import prisma from "@/src/db/client";
import type { Prisma } from "@/src/generated/prisma";

export interface PrioritizationConfig {
  id: string;
  conversationId: string;
  minimumNotifyPrice: number;
  customValuePrompt?: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePrioritizationConfigInput {
  conversationId: string;
  minimumNotifyPrice: number;
  customValuePrompt?: string;
  isEnabled?: boolean;
}

export interface UpdatePrioritizationConfigInput {
  minimumNotifyPrice?: number;
  customValuePrompt?: string;
  isEnabled?: boolean;
}

export interface MessageEvaluation {
  id: string;
  queuedMessageId: string;
  conversationId: string;
  baseValue: number;
  bribeAmount: number;
  totalValue: number;
  passed: boolean;
  evaluationReason: string;
  evaluatedAt: Date;
}

export interface CreateMessageEvaluationInput {
  queuedMessageId: string;
  conversationId: string;
  baseValue: number;
  bribeAmount: number;
  totalValue: number;
  passed: boolean;
  evaluationReason: string;
}

/**
 * Get prioritization config for a conversation
 * Returns null if no config exists (caller should use defaults)
 */
export async function getPrioritizationConfig(
  conversationId: string,
): Promise<PrioritizationConfig | null> {
  try {
    const config = await prisma.prioritizationConfig.findUnique({
      where: { conversationId },
    });

    return config ? formatPrioritizationConfig(config) : null;
  } catch (error) {
    // If table doesn't exist or other DB error, return null (use defaults)
    console.warn(
      `Could not get prioritization config for ${conversationId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Create or update prioritization config for a conversation
 */
export async function upsertPrioritizationConfig(
  conversationId: string,
  input: Omit<CreatePrioritizationConfigInput, "conversationId">,
): Promise<PrioritizationConfig> {
  try {
    const config = await prisma.prioritizationConfig.upsert({
      where: { conversationId },
      create: {
        conversationId,
        minimumNotifyPrice: input.minimumNotifyPrice,
        customValuePrompt: input.customValuePrompt,
        isEnabled: input.isEnabled ?? true,
      },
      update: {
        minimumNotifyPrice: input.minimumNotifyPrice,
        customValuePrompt: input.customValuePrompt,
        isEnabled: input.isEnabled,
      },
    });

    return formatPrioritizationConfig(config);
  } catch (error) {
    console.error(
      `Could not upsert prioritization config for ${conversationId}:`,
      error instanceof Error ? error.message : error,
    );
    throw new Error(
      `Prioritization config table may not exist. Run database migrations first: pnpm prisma migrate dev`,
    );
  }
}

/**
 * Update an existing prioritization config
 */
export async function updatePrioritizationConfig(
  conversationId: string,
  input: UpdatePrioritizationConfigInput,
): Promise<PrioritizationConfig> {
  const config = await prisma.prioritizationConfig.update({
    where: { conversationId },
    data: {
      minimumNotifyPrice: input.minimumNotifyPrice,
      customValuePrompt: input.customValuePrompt,
      isEnabled: input.isEnabled,
    },
  });

  return formatPrioritizationConfig(config);
}

/**
 * Delete a prioritization config
 */
export async function deletePrioritizationConfig(
  conversationId: string,
): Promise<void> {
  await prisma.prioritizationConfig.delete({
    where: { conversationId },
  });
}

/**
 * Create a message evaluation record
 */
export async function createMessageEvaluation(
  input: CreateMessageEvaluationInput,
): Promise<MessageEvaluation> {
  try {
    const evaluation = await prisma.messageEvaluation.create({
      data: {
        queuedMessageId: input.queuedMessageId,
        conversationId: input.conversationId,
        baseValue: input.baseValue,
        bribeAmount: input.bribeAmount,
        totalValue: input.totalValue,
        passed: input.passed,
        evaluationReason: input.evaluationReason,
      },
    });

    return formatMessageEvaluation(evaluation);
  } catch (error) {
    // If table doesn't exist, log warning but don't fail the evaluation
    console.warn(
      `Could not store message evaluation:`,
      error instanceof Error ? error.message : error,
    );
    // Return a mock evaluation object so the flow continues
    return {
      id: "mock-" + Date.now(),
      queuedMessageId: input.queuedMessageId,
      conversationId: input.conversationId,
      baseValue: input.baseValue,
      bribeAmount: input.bribeAmount,
      totalValue: input.totalValue,
      passed: input.passed,
      evaluationReason: input.evaluationReason,
      evaluatedAt: new Date(),
    };
  }
}

/**
 * Get all evaluations for a specific queued message
 * Useful for multi-recipient messages where one message has multiple evaluations
 */
export async function getEvaluationsForMessage(
  queuedMessageId: string,
): Promise<MessageEvaluation[]> {
  const evaluations = await prisma.messageEvaluation.findMany({
    where: { queuedMessageId },
    orderBy: { evaluatedAt: "desc" },
  });

  return evaluations.map(formatMessageEvaluation);
}

/**
 * Get all evaluations for a specific conversation
 * Useful for analytics and understanding what messages reached this user
 */
export async function getEvaluationsForConversation(
  conversationId: string,
  limit: number = 50,
): Promise<MessageEvaluation[]> {
  const evaluations = await prisma.messageEvaluation.findMany({
    where: { conversationId },
    orderBy: { evaluatedAt: "desc" },
    take: limit,
  });

  return evaluations.map(formatMessageEvaluation);
}

/**
 * Get evaluation by ID
 */
export async function getEvaluationById(
  id: string,
): Promise<MessageEvaluation | null> {
  const evaluation = await prisma.messageEvaluation.findUnique({
    where: { id },
  });

  return evaluation ? formatMessageEvaluation(evaluation) : null;
}

/**
 * Get statistics for evaluations (passed vs failed)
 */
export async function getEvaluationStats(conversationId: string): Promise<{
  total: number;
  passed: number;
  failed: number;
  averageValue: number;
}> {
  const [total, passed, avgResult] = await Promise.all([
    prisma.messageEvaluation.count({
      where: { conversationId },
    }),
    prisma.messageEvaluation.count({
      where: { conversationId, passed: true },
    }),
    prisma.messageEvaluation.aggregate({
      where: { conversationId },
      _avg: { totalValue: true },
    }),
  ]);

  return {
    total,
    passed,
    failed: total - passed,
    averageValue: avgResult._avg.totalValue?.toNumber() ?? 0,
  };
}

/**
 * Format PrioritizationConfig from database to application format
 */
function formatPrioritizationConfig(config: {
  id: string;
  conversationId: string;
  minimumNotifyPrice: Prisma.Decimal;
  customValuePrompt: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PrioritizationConfig {
  return {
    id: config.id,
    conversationId: config.conversationId,
    minimumNotifyPrice: config.minimumNotifyPrice.toNumber(),
    customValuePrompt: config.customValuePrompt ?? undefined,
    isEnabled: config.isEnabled,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Format MessageEvaluation from database to application format
 */
function formatMessageEvaluation(evaluation: {
  id: string;
  queuedMessageId: string;
  conversationId: string;
  baseValue: Prisma.Decimal;
  bribeAmount: Prisma.Decimal;
  totalValue: Prisma.Decimal;
  passed: boolean;
  evaluationReason: string;
  evaluatedAt: Date;
}): MessageEvaluation {
  return {
    id: evaluation.id,
    queuedMessageId: evaluation.queuedMessageId,
    conversationId: evaluation.conversationId,
    baseValue: evaluation.baseValue.toNumber(),
    bribeAmount: evaluation.bribeAmount.toNumber(),
    totalValue: evaluation.totalValue.toNumber(),
    passed: evaluation.passed,
    evaluationReason: evaluation.evaluationReason,
    evaluatedAt: evaluation.evaluatedAt,
  };
}

