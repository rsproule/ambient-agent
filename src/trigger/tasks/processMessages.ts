import {
  getNextMessages,
  markMessageCompleted,
  markMessageFailed,
  markMessageProcessing,
} from "@/src/db/messageQueue";
import type { QueuedMessage } from "@/src/lib/message-queue/types";
import { deliverMessage } from "@/src/services/delivery";
import { evaluateMessage } from "@/src/services/prioritization";
import { resolveRecipients } from "@/src/services/recipients";
import { task } from "@trigger.dev/sdk/v3";

type ProcessMessagesPayload = {
  batchSize?: number; // Number of messages to process in this run (default: 10)
};

/**
 * Message Processor Task
 *
 * Implements the full prioritization and delivery flow:
 * 1. Fetches pending messages from the queue
 * 2. Resolves recipients based on target type
 * 3. For each recipient:
 *    - Evaluates message value using AI + bribe amount
 *    - If passes threshold, delivers via Mr. Whiskers
 *    - Stores evaluation record
 * 4. Updates message status
 */
export const processMessages = task({
  id: "process-messages",
  run: async (payload: ProcessMessagesPayload = {}) => {
    const batchSize = payload.batchSize || 10;

    // Fetch pending messages from the queue
    const messages = await getNextMessages(batchSize);

    if (messages.length === 0) {
      console.log("No pending messages to process");
      return {
        success: true,
        processed: 0,
        skipped: "no_messages",
      };
    }

    console.log(`Processing ${messages.length} queued messages`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ messageId: string; error: string }>,
      totalRecipients: 0,
      totalEvaluations: 0,
      totalPassed: 0,
      totalDelivered: 0,
    };

    // Process each message
    for (const message of messages) {
      try {
        // Mark as processing
        await markMessageProcessing(message.id);

        // Process the message through the full flow
        const messageResults = await processMessage(message);

        // Update aggregate results
        results.totalRecipients += messageResults.recipients;
        results.totalEvaluations += messageResults.evaluations;
        results.totalPassed += messageResults.passed;
        results.totalDelivered += messageResults.delivered;

        // Mark as completed
        await markMessageCompleted(message.id);
        results.success++;

        console.log(
          `Successfully processed message ${message.id}: ` +
            `${messageResults.delivered}/${messageResults.recipients} delivered`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Mark as failed with error
        await markMessageFailed(message.id, errorMessage);
        results.failed++;
        results.errors.push({
          messageId: message.id,
          error: errorMessage,
        });

        console.error(`Failed to process message ${message.id}:`, errorMessage);
      }
    }

    return {
      success: true,
      processed: results.success,
      failed: results.failed,
      errors: results.errors,
      stats: {
        totalRecipients: results.totalRecipients,
        totalEvaluations: results.totalEvaluations,
        totalPassed: results.totalPassed,
        totalDelivered: results.totalDelivered,
      },
    };
  },
});

interface MessageProcessingResult {
  recipients: number;
  evaluations: number;
  passed: number;
  delivered: number;
}

/**
 * Process a single message through the full prioritization and delivery flow
 */
async function processMessage(
  message: QueuedMessage,
): Promise<MessageProcessingResult> {
  console.log(`[Process] Starting message ${message.id}`, {
    source: message.source,
    targetType: message.target.type,
    hasBribe: !!message.bribePayload,
  });

  // Step 1: Resolve recipients based on target type
  const recipients = await resolveRecipients(message.target);

  console.log(
    `[Process] Resolved ${recipients.length} recipients for message ${message.id}`,
  );

  if (recipients.length === 0) {
    console.warn(
      `[Process] No recipients found for message ${
        message.id
      }. Target: ${JSON.stringify(message.target)}`,
    );
    return {
      recipients: 0,
      evaluations: 0,
      passed: 0,
      delivered: 0,
    };
  }

  const results: MessageProcessingResult = {
    recipients: recipients.length,
    evaluations: 0,
    passed: 0,
    delivered: 0,
  };

  // Step 2: Evaluate and deliver to each recipient
  for (const recipient of recipients) {
    try {
      console.log(
        `[Process] Evaluating message ${message.id} for recipient ${recipient.userId} (${recipient.conversationId})`,
      );

      // Evaluate the message for this specific recipient/conversation
      const evaluation = await evaluateMessage(
        message,
        recipient.conversationId,
      );

      results.evaluations++;

      if (evaluation.passed) {
        results.passed++;

        console.log(
          `[Process] Message ${message.id} passed for ${recipient.conversationId} ` +
            `(value: $${evaluation.totalValue}, threshold: $${evaluation.threshold})`,
        );

        // Deliver the message
        const deliveryResult = await deliverMessage(
          message,
          recipient.conversationId,
          evaluation,
        );

        if (deliveryResult.success) {
          results.delivered++;
          console.log(
            `[Process] Successfully delivered message ${message.id} to ${recipient.conversationId}`,
          );
        } else {
          console.error(
            `[Process] Failed to deliver message ${message.id} to ${recipient.conversationId}: ${deliveryResult.error}`,
          );
        }
      } else {
        console.log(
          `[Process] Message ${message.id} did not pass for ${recipient.conversationId} ` +
            `(value: $${evaluation.totalValue}, threshold: $${evaluation.threshold})`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[Process] Error processing recipient ${recipient.userId}: ${errorMessage}`,
      );
      // Continue to next recipient on error
    }
  }

  console.log(
    `[Process] Completed message ${message.id}: ` +
      `${results.delivered}/${results.recipients} delivered, ` +
      `${results.passed}/${results.evaluations} passed evaluation`,
  );

  return results;
}
