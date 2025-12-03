import {
  createMessageEvaluation,
  getPrioritizationConfig,
  type CreateMessageEvaluationInput,
} from "@/src/db/prioritization";
import type { QueuedMessage } from "@/src/lib/message-queue/types";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

const anthropic = createAnthropic({
  apiKey: process.env.ECHO_API_KEY,
  baseURL: "https://echo.router.merit.systems",
});

// Use a fast, cheap model for value evaluation
const model = anthropic("claude-haiku-4-5-20251001");

/**
 * Default configuration values for prioritization
 */
export const DEFAULT_CONFIG = {
  minimumNotifyPrice: 0, // By default, deliver all messages (no filtering)
  isEnabled: true, // Prioritization is enabled by default
  customValuePrompt: null, // No custom prompt by default
} as const;

/**
 * Default system prompt for message value evaluation
 */
const DEFAULT_VALUE_PROMPT = `
You are evaluating an incoming message for its relevance and value to the recipient.

Your task is to output a single dollar amount representing the message's value:
- Positive values = beneficial, interesting, or valuable content
- Negative values = spam, annoying, or costly (waste of time/attention)
- Zero = neutral or informational

Consider:
- Is this relevant to the recipient?
- Is this time-sensitive or urgent?
- Does this provide value (information, opportunity, entertainment)?
- Is this spam or low-quality content?

Output a dollar amount that represents the value of this message to the recipient.
Examples:
- Important business opportunity: $50-$500
- Useful information: $5-$20
- Casual update: $1-$5
- Neutral/informational: $0
- Mild annoyance/spam: -$1 to -$5
- Significant spam/scam: -$10 to -$50
`.trim();

/**
 * Schema for AI response
 */
const MessageValueSchema = z.object({
  value: z
    .number()
    .describe("The dollar value of this message (can be negative)"),
  reason: z
    .string()
    .describe("Brief explanation of why this value was assigned"),
});

export interface EvaluationResult {
  passed: boolean;
  totalValue: number;
  baseValue: number;
  bribeAmount: number;
  reason: string;
  threshold: number;
}

/**
 * Evaluate a message for a specific conversation
 *
 * This function:
 * 1. Fetches the prioritization config for the conversation
 * 2. Uses AI to calculate the base value of the message
 * 3. Adds any bribe amount to the base value
 * 4. Checks if total value meets the threshold
 * 5. Stores the evaluation in the database
 *
 * @param queuedMessage The message to evaluate
 * @param conversationId The conversation to evaluate for (phone number or group_id)
 * @returns Evaluation result with pass/fail and values
 */
export async function evaluateMessage(
  queuedMessage: QueuedMessage,
  conversationId: string,
): Promise<EvaluationResult> {
  const before = performance.now();

  // Get prioritization config (or use defaults)
  const config = await getPrioritizationConfig(conversationId);

  const threshold =
    config?.minimumNotifyPrice ?? DEFAULT_CONFIG.minimumNotifyPrice;
  const isEnabled = config?.isEnabled ?? DEFAULT_CONFIG.isEnabled;

  // If prioritization is disabled, always pass
  if (!isEnabled) {
    console.log(
      `[Prioritization] Disabled for ${conversationId}, auto-passing message ${queuedMessage.id}`,
    );

    const evaluation: EvaluationResult = {
      passed: true,
      totalValue: 0,
      baseValue: 0,
      bribeAmount: 0,
      reason: "Prioritization disabled for this conversation",
      threshold,
    };

    // Still store the evaluation
    await storeEvaluation(queuedMessage.id, conversationId, evaluation);

    return evaluation;
  }

  // Calculate base value using AI
  const baseValue = await calculateBaseValue(
    queuedMessage,
    config?.customValuePrompt,
  );

  // Extract bribe amount if present
  const bribeAmount = queuedMessage.bribePayload?.amount ?? 0;

  // Calculate total value
  const totalValue = baseValue.value + bribeAmount;

  // Check if it passes the threshold
  const passed = totalValue >= threshold;

  const evaluation: EvaluationResult = {
    passed,
    totalValue,
    baseValue: baseValue.value,
    bribeAmount,
    reason: baseValue.reason,
    threshold,
  };

  // Store evaluation in database
  await storeEvaluation(queuedMessage.id, conversationId, evaluation);

  const after = performance.now();
  console.log(
    `[Prioritization] Message ${queuedMessage.id} evaluated for ${conversationId}: ` +
      `baseValue=$${baseValue.value}, bribe=$${bribeAmount}, total=$${totalValue}, ` +
      `threshold=$${threshold}, passed=${passed} (${Math.round(
        after - before,
      )}ms)`,
  );

  return evaluation;
}

/**
 * Calculate the base value of a message using AI
 */
async function calculateBaseValue(
  queuedMessage: QueuedMessage,
  customPrompt?: string,
): Promise<{ value: number; reason: string }> {
  // Build the system prompt
  const systemPrompt = customPrompt
    ? `${DEFAULT_VALUE_PROMPT}\n\n--- CUSTOM INSTRUCTIONS ---\n${customPrompt}`
    : DEFAULT_VALUE_PROMPT;

  // Format the message payload for evaluation
  const messageContent = formatMessageForEvaluation(queuedMessage);

  // Call AI to evaluate
  const { object } = await generateObject({
    model,
    schema: MessageValueSchema,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: messageContent,
      },
    ],
  });

  return {
    value: object.value,
    reason: object.reason,
  };
}

/**
 * Format the queued message for AI evaluation
 */
function formatMessageForEvaluation(queuedMessage: QueuedMessage): string {
  const parts: string[] = [];

  parts.push("--- MESSAGE TO EVALUATE ---");
  parts.push(`Source: ${queuedMessage.source}`);

  // Include payload as formatted JSON
  parts.push("\nMessage Content:");
  parts.push(JSON.stringify(queuedMessage.payload, null, 2));

  // Include bribe info if present (for context, not for direct value calculation)
  if (queuedMessage.bribePayload) {
    parts.push("\nNote: Sender included payment/bribe metadata:");
    parts.push(JSON.stringify(queuedMessage.bribePayload, null, 2));
    parts.push(
      "(You should evaluate the message content independently. The payment amount will be added separately.)",
    );
  }

  return parts.join("\n");
}

/**
 * Store the evaluation result in the database
 */
async function storeEvaluation(
  queuedMessageId: string,
  conversationId: string,
  evaluation: EvaluationResult,
): Promise<void> {
  const input: CreateMessageEvaluationInput = {
    queuedMessageId,
    conversationId,
    baseValue: evaluation.baseValue,
    bribeAmount: evaluation.bribeAmount,
    totalValue: evaluation.totalValue,
    passed: evaluation.passed,
    evaluationReason: `${evaluation.reason} (Threshold: $${evaluation.threshold})`,
  };

  await createMessageEvaluation(input);
}

/**
 * Batch evaluate a message for multiple conversations
 */
export async function evaluateMessageForRecipients(
  queuedMessage: QueuedMessage,
  conversationIds: string[],
): Promise<Map<string, EvaluationResult>> {
  const results = new Map<string, EvaluationResult>();

  // Evaluate for each conversation in parallel
  const evaluations = await Promise.all(
    conversationIds.map(async (conversationId) => {
      const result = await evaluateMessage(queuedMessage, conversationId);
      return { conversationId, result };
    }),
  );

  // Build result map
  for (const { conversationId, result } of evaluations) {
    results.set(conversationId, result);
  }

  console.log(
    `[Prioritization] Batch evaluation complete: ${
      evaluations.filter((e) => e.result.passed).length
    }/${evaluations.length} passed`,
  );

  return results;
}
