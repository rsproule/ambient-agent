/**
 * Execute Claude Task
 *
 * Trigger.dev task that:
 * 1. Calls claudflare POST /execute
 * 2. Consumes the SSE stream
 * 3. Filters/aggregates events and forwards meaningful updates to user
 * 4. Sends final summary when complete
 */

import { saveAssistantMessage } from "@/src/db/conversation";
import { LoopMessageClient } from "@/src/lib/loopmessage-sdk/client";
import { task } from "@trigger.dev/sdk/v3";

const loopClient = new LoopMessageClient({
  loopAuthKey: process.env.LOOP_AUTH_KEY!,
  loopSecretKey: process.env.LOOP_SECRET_KEY!,
  senderName: process.env.LOOP_SENDER_NAME!,
});

type ExecuteClaudeTaskPayload = {
  requestId: string;
  task: string;
  workspaceUsername: string;
  conversationId: string;
  recipient?: string;
  group?: string;
  userId: string;
};

// Stream event types from Claude CLI
interface ClaudeStreamEvent {
  type: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
    }>;
  };
  content_block?: {
    type: string;
    text?: string;
    name?: string;
  };
  result?: {
    cost_usd?: number;
    duration_ms?: number;
  };
}

/**
 * Execute a Claude task in the user's workspace
 */
export const executeClaudeTask = task({
  id: "execute-claude-task",
  machine: {
    preset: "medium-1x", // 1 vCPU, 2 GB RAM
  },
  run: async (payload: ExecuteClaudeTaskPayload) => {
    const {
      requestId,
      task: taskDescription,
      workspaceUsername,
      conversationId,
      recipient,
      group,
    } = payload;

    console.log(`[ExecuteClaudeTask] Starting task ${requestId}`, {
      workspaceUsername,
      conversationId,
    });

    const claudflareUrl = process.env.CLAUDFLARE_URL;
    const claudflareSecret = process.env.CLAUDFLARE_API_KEY;

    if (!claudflareUrl || !claudflareSecret) {
      console.error(
        "[ExecuteClaudeTask] Missing CLAUDFLARE_URL or CLAUDFLARE_API_KEY",
      );
      await sendMessage(
        conversationId,
        recipient,
        group,
        "Task failed: Claudflare not configured",
      );
      return { success: false, error: "Claudflare not configured" };
    }

    try {
      // Call claudflare /execute
      const response = await fetch(`${claudflareUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${claudflareSecret}`,
          "X-Request-ID": requestId,
        },
        body: JSON.stringify({
          task: taskDescription,
          repo: `MeritSpace/${workspaceUsername}`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ExecuteClaudeTask] Claudflare error:", errorText);

        await sendMessage(
          conversationId,
          recipient,
          group,
          `Task failed to start: ${errorText}`,
        );

        return { success: false, error: errorText };
      }

      // Consume the SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // Accumulator for filtering
      const accumulator = new MessageAccumulator(
        conversationId,
        recipient,
        group,
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line) as ClaudeStreamEvent;
            await accumulator.processEvent(event);
          } catch {
            // Not JSON, skip
          }
        }
      }

      // Flush any remaining messages and send completion
      await accumulator.flush(true);

      console.log(`[ExecuteClaudeTask] Task completed: ${requestId}`);

      return {
        success: true,
        requestId,
        summary: accumulator.getSummary(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[ExecuteClaudeTask] Error:", errorMsg);

      await sendMessage(
        conversationId,
        recipient,
        group,
        `Task failed: ${errorMsg}`,
      );

      return { success: false, error: errorMsg };
    }
  },
});

/**
 * Accumulates and filters stream events, deciding when to send updates
 */
class MessageAccumulator {
  private conversationId: string;
  private recipient: string | undefined;
  private group: string | undefined;

  private textChunks: string[] = [];
  private toolsUsed: string[] = [];
  private lastSentAt: number = 0;
  private totalCost: number = 0;
  private hasSentInitial: boolean = false;

  // Send update at most every 30 seconds
  private readonly MIN_INTERVAL_MS = 30000;

  constructor(
    conversationId: string,
    recipient: string | undefined,
    group: string | undefined,
  ) {
    this.conversationId = conversationId;
    this.recipient = recipient;
    this.group = group;
  }

  async processEvent(event: ClaudeStreamEvent): Promise<void> {
    switch (event.type) {
      case "assistant":
        // Accumulate assistant text
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text" && block.text) {
              this.textChunks.push(block.text);
            }
            if (block.type === "tool_use" && block.name) {
              this.toolsUsed.push(block.name);
            }
          }
        }
        break;

      case "content_block_stop":
        // A content block finished - good time to check if we should send
        await this.maybeFlush();
        break;

      case "result":
        // Task complete
        if (event.result?.cost_usd) {
          this.totalCost = event.result.cost_usd;
        }
        break;
    }
  }

  /**
   * Check if we should send an update based on time and content
   */
  private async maybeFlush(): Promise<void> {
    const now = Date.now();
    const timeSinceLastSent = now - this.lastSentAt;

    // Don't spam - wait at least MIN_INTERVAL_MS between messages
    if (timeSinceLastSent < this.MIN_INTERVAL_MS && this.hasSentInitial) {
      return;
    }

    // Check if we have meaningful content to send
    const hasContent = this.textChunks.length > 0 || this.toolsUsed.length > 0;
    if (!hasContent) {
      return;
    }

    // For first message, send a brief "working on it"
    if (!this.hasSentInitial) {
      await sendMessage(
        this.conversationId,
        this.recipient,
        this.group,
        "working on it...",
      );
      this.hasSentInitial = true;
      this.lastSentAt = now;
      return;
    }

    // Decide if this update is worth sending
    // For now: send if we used tools (meaningful progress indicator)
    if (this.toolsUsed.length > 0) {
      const toolList = [...new Set(this.toolsUsed)].slice(0, 3).join(", ");
      await sendMessage(
        this.conversationId,
        this.recipient,
        this.group,
        `still working... (using ${toolList})`,
      );
      this.toolsUsed = [];
      this.lastSentAt = now;
    }
  }

  /**
   * Send final summary
   */
  async flush(isComplete: boolean): Promise<void> {
    if (isComplete) {
      // Get last meaningful text from Claude
      const lastText =
        this.textChunks.length > 0
          ? this.textChunks[this.textChunks.length - 1]
          : null;

      // Send completion message
      let message = "Done! Changes have been committed to your workspace.";
      if (lastText && lastText.length < 500) {
        message = lastText;
      }

      await sendMessage(
        this.conversationId,
        this.recipient,
        this.group,
        message,
      );
    }
  }

  getSummary(): { toolsUsed: string[]; cost: number } {
    return {
      toolsUsed: [...new Set(this.toolsUsed)],
      cost: this.totalCost,
    };
  }
}

/**
 * Helper to send a message to the user
 */
async function sendMessage(
  conversationId: string,
  recipient: string | undefined,
  group: string | undefined,
  text: string,
): Promise<void> {
  try {
    const baseParams = group ? { group } : { recipient: recipient! };

    const response = await loopClient.sendLoopMessage({
      ...baseParams,
      text,
    });

    await saveAssistantMessage(conversationId, text, response.message_id);
  } catch (error) {
    console.error("[ExecuteClaudeTask] Failed to send message:", error);
  }
}
