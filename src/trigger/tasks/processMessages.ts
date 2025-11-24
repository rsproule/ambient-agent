import {
  getNextMessages,
  markMessageCompleted,
  markMessageFailed,
  markMessageProcessing,
} from "@/src/db/messageQueue";
import { getPhoneNumberForUser } from "@/src/db/user";
import {
  isGlobalTarget,
  isSegmentTarget,
  isUserTarget,
  type QueuedMessage,
} from "@/src/lib/message-queue/types";
import { task } from "@trigger.dev/sdk/v3";

type ProcessMessagesPayload = {
  batchSize?: number; // Number of messages to process in this run (default: 10)
};

/**
 * Message Processor Task
 *
 * This is boilerplate scaffolding for processing queued messages.
 * The actual processing logic should be implemented based on your business needs.
 *
 * This task:
 * 1. Fetches pending messages from the queue
 * 2. Processes each message based on its target type
 * 3. Updates message status appropriately
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
    };

    // Process each message
    for (const message of messages) {
      try {
        // Mark as processing
        await markMessageProcessing(message.id);

        // Process based on target type
        await processMessage(message);

        // Mark as completed
        await markMessageCompleted(message.id);
        results.success++;

        console.log(
          `Successfully processed message ${message.id} from source: ${message.source}`,
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
    };
  },
});

/**
 * Process a single message based on its target type
 *
 * TODO: Implement actual processing logic for each target type
 * This is currently a placeholder that logs the message details.
 */
async function processMessage(message: QueuedMessage): Promise<void> {
  console.log(`Processing message ${message.id}`, {
    source: message.source,
    targetType: message.target.type,
    hasBribe: !!message.bribePayload,
  });

  // Process based on target type
  if (isUserTarget(message.target)) {
    await processUserMessage(message);
  } else if (isGlobalTarget(message.target)) {
    await processGlobalMessage(message);
  } else if (isSegmentTarget(message.target)) {
    await processSegmentMessage(message);
  } else {
    throw new Error(`Unknown target type: ${JSON.stringify(message.target)}`);
  }
}

/**
 * Process a message targeted at a specific user
 *
 * This function:
 * 1. Looks up the user's phone number from the User table
 * 2. Sends a DM to that phone number
 * 3. Handles any bribe/payment logic
 *
 * TODO: Implement actual message sending logic
 */
async function processUserMessage(message: QueuedMessage): Promise<void> {
  if (!isUserTarget(message.target)) {
    throw new Error("Invalid target type for processUserMessage");
  }

  const userId = message.target.userId;

  // Look up the user's phone number
  const phoneNumber = await getPhoneNumberForUser(userId);

  if (!phoneNumber) {
    throw new Error(
      `User ${userId} does not have a phone number. Cannot send DM.`,
    );
  }

  console.log(
    `[USER MESSAGE] Processing for user ${userId} (phone: ${phoneNumber})`,
    {
      messageId: message.id,
      source: message.source,
      payload: message.payload,
      bribePayload: message.bribePayload,
    },
  );

  // TODO: Implement actual message sending
  // Here you would typically:
  // 1. Use LoopMessage SDK or similar to send DM to phoneNumber
  // 2. Handle any bribe/payment logic for prioritization
  // 3. Log the delivery
  // 4. Update any user preferences or history
  //
  // Example:
  // await client.sendLoopMessage({
  //   recipient: phoneNumber,
  //   text: message.payload.message,
  // });

  console.log(`✓ Would send DM to user ${userId} at phone ${phoneNumber}`);
}

/**
 * Process a global broadcast message
 *
 * TODO: Implement global message processing
 * This might involve:
 * - Broadcasting to all active users
 * - Publishing to a global event stream
 * - Triggering system-wide notifications
 * - etc.
 */
async function processGlobalMessage(message: QueuedMessage): Promise<void> {
  if (!isGlobalTarget(message.target)) {
    throw new Error("Invalid target type for processGlobalMessage");
  }

  // TODO: Implement actual global message processing
  console.log(`[GLOBAL MESSAGE] Processing global broadcast`, {
    messageId: message.id,
    source: message.source,
    payload: message.payload,
    bribePayload: message.bribePayload,
  });

  // Placeholder: Here you would typically:
  // 1. Get list of all active users or subscribers
  // 2. Broadcast the message to all recipients
  // 3. Handle any prioritization based on bribe/payment
  // 4. Track delivery metrics

  // For now, just log the action
  console.log(`✓ Would broadcast message globally`);
}

/**
 * Process a message targeted at a specific segment
 *
 * TODO: Implement segment-specific message processing
 * This might involve:
 * - Looking up users in the segment
 * - Sending to all users in that segment
 * - Handling segment-specific logic or preferences
 * - etc.
 */
async function processSegmentMessage(message: QueuedMessage): Promise<void> {
  if (!isSegmentTarget(message.target)) {
    throw new Error("Invalid target type for processSegmentMessage");
  }

  const segmentId = message.target.segmentId;

  // TODO: Implement actual segment message processing
  console.log(`[SEGMENT MESSAGE] Processing for segment ${segmentId}`, {
    messageId: message.id,
    source: message.source,
    payload: message.payload,
    bribePayload: message.bribePayload,
  });

  // Placeholder: Here you would typically:
  // 1. Look up the segment definition by segmentId
  // 2. Query all users matching the segment criteria
  // 3. Send the message to each user in the segment
  // 4. Handle any prioritization or rate limiting
  // 5. Track segment delivery metrics

  // For now, just log the action
  console.log(`✓ Would send message to segment ${segmentId}`);
}
