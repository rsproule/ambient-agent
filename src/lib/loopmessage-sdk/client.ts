/**
 * LoopMessage API Client - Direct HTTP calls to LoopMessage API
 * Based on: https://docs.loopmessage.com/imessage-conversation-api/send-message
 */

import { z } from "zod";
import {
  API_ENDPOINTS,
  MESSAGE_EFFECTS,
  MESSAGE_REACTIONS,
  SERVICES,
  type MessageEffect,
  type MessageReaction,
} from "./constants";

/**
 * Configuration schema for LoopMessage API client
 */
export const LoopMessageConfigSchema = z.object({
  loopAuthKey: z.string().min(1, "Loop Auth Key is required"),
  loopSecretKey: z.string().min(1, "Loop Secret Key is required"),
  senderName: z.string().min(1, "Sender Name is required"),
});

/**
 * Parameters for sending a message - matches API exactly
 */
export const SendMessageParamsSchema = z
  .object({
    /** Phone number (with country code) or email for individual message */
    recipient: z.string().optional(),
    /** Group ID for group message (mutually exclusive with recipient) */
    group: z.string().optional(),
    /** Message text content (required, max 10,000 characters) */
    text: z.string().max(10000, "Text must be less than 10,000 characters"),
    /** Array of public HTTPS image URLs (max 3 attachments) */
    attachments: z
      .array(
        z
          .string()
          .url()
          .startsWith("https://", "Attachments must be HTTPS URLs"),
      )
      .max(3, "Maximum 3 attachments allowed")
      .optional(),
    /** Subject line - displays as bold title before message text */
    subject: z.string().optional(),
    /** Visual effect for message delivery (iMessage only) */
    effect: z.enum(MESSAGE_EFFECTS).optional(),
    /** Message ID to reply to (creates threaded reply) */
    reply_to_id: z.string().optional(),
    /** Message ID to react to (required for reactions) */
    message_id: z.string().optional(),
    /** Type of reaction to send (requires message_id) */
    reaction: z.enum(MESSAGE_REACTIONS).optional(),
    /** Timeout in seconds (minimum 5 seconds) */
    timeout: z.number().min(5, "Timeout must be at least 5 seconds").optional(),
    /** Message service type (default: 'imessage') */
    service: z.enum(SERVICES).optional(),
    /** HTTPS URL for webhook status updates */
    status_callback: z
      .string()
      .url()
      .startsWith("https://", "Status callback must be HTTPS URL")
      .optional(),
    /** Custom header for webhook requests */
    status_callback_header: z.string().optional(),
    /** Custom metadata (max 1,000 chars, included in webhooks) */
    passthrough: z
      .string()
      .max(1000, "Passthrough must be less than 1,000 characters")
      .optional(),
  })
  .refine((data) => data.recipient || data.group, {
    message: "Either recipient or group must be specified",
    path: ["recipient"],
  })
  .refine((data) => !(data.recipient && data.group), {
    message: "Cannot specify both recipient and group",
    path: ["group"],
  });

/**
 * Response from LoopMessage API
 */
export const LoopMessageResponseSchema = z.object({
  message_id: z.string(),
  success: z.boolean(),
  recipient: z.string().optional(),
  group: z
    .object({
      group_id: z.string(),
      name: z.string().optional(),
      participants: z.array(z.string()),
    })
    .optional(),
  text: z.string(),
  message: z.string().optional(),
});

// Export inferred types for backward compatibility
export type LoopMessageConfig = z.infer<typeof LoopMessageConfigSchema>;
export type SendMessageParams = z.infer<typeof SendMessageParamsSchema>;
export type LoopMessageResponse = z.infer<typeof LoopMessageResponseSchema>;

/**
 * LoopMessage API Client
 */
export class LoopMessageClient {
  constructor(private config: LoopMessageConfig) {
    // Validate configuration at construction time
    LoopMessageConfigSchema.parse(config);
  }

  /**
   * Send a basic message
   */
  async sendLoopMessage(
    params: Omit<SendMessageParams, "sender_name">,
  ): Promise<LoopMessageResponse> {
    // Validate parameters
    const fullParams = { ...params, sender_name: this.config.senderName };
    SendMessageParamsSchema.safeExtend({ sender_name: z.string() }).parse(
      fullParams,
    );

    return this.sendRequest(fullParams);
  }

  /**
   * Send a message with an effect
   */
  async sendMessageWithEffect(
    params: Omit<SendMessageParams, "sender_name"> & { effect: MessageEffect },
  ): Promise<LoopMessageResponse> {
    return this.sendRequest({
      ...params,
      sender_name: this.config.senderName,
    });
  }

  /**
   * Send a reply to a message
   */
  async sendReply(
    params: Omit<SendMessageParams, "sender_name"> & { reply_to_id: string },
  ): Promise<LoopMessageResponse> {
    return this.sendRequest({
      ...params,
      sender_name: this.config.senderName,
    });
  }

  /**
   * Send a reaction to a message
   */
  async sendReaction(
    params: Omit<SendMessageParams, "sender_name"> & {
      message_id: string;
      reaction: MessageReaction;
    },
  ): Promise<LoopMessageResponse> {
    return this.sendRequest({
      ...params,
      sender_name: this.config.senderName,
    });
  }

  /**
   * Make the actual HTTP request to LoopMessage API
   */
  private async sendRequest(
    params: SendMessageParams & { sender_name: string },
  ): Promise<LoopMessageResponse> {
    const url = `${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.SEND_MESSAGE}`;
    if (!params.recipient && !params.group) {
      throw new Error("Either recipient or group must be specified");
    }
    const recipient = params.recipient || params.group;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.config.loopAuthKey,
        "Loop-Secret-Key": this.config.loopSecretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Log detailed error for non-200 responses
      console.error("LOOPMESSAGE API REQUEST FAILED", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        recipient,
        params,
      });

      // Provide specific guidance based on status code
      if (response.status === 400) {
        console.error("BAD REQUEST - The send request is malformed", {});
      } else if (response.status === 401) {
        console.error("UNAUTHORIZED - Invalid API credentials", {
          suggestion:
            "Verify LOOP_AUTH_KEY and LOOP_SECRET_KEY environment variables",
        });
      } else if (response.status === 403) {
        console.error("FORBIDDEN - Account issue or rate limiting", {
          suggestion: "Check LoopMessage account status and rate limits",
        });
      } else if (response.status === 429) {
        console.error("RATE LIMITED - Too many requests", {
          suggestion:
            "Implement exponential backoff and reduce request frequency",
        });
      } else if (response.status >= 500) {
        console.error("SERVER ERROR - LoopMessage service issue", {
          suggestion:
            "Retry with exponential backoff, check LoopMessage status page",
        });
      }

      throw new Error(
        `LoopMessage API error (${response.status}): ${errorText}`,
      );
    }

    const result = await response.json();

    // Validate response structure
    const validatedResult = LoopMessageResponseSchema.parse(result);

    // Check if the API returned success: false
    if (validatedResult.success === false) {
      console.error("LOOPMESSAGE API RETURNED SUCCESS=FALSE", {
        recipient,
        message_id: validatedResult.message_id,
        error_message: validatedResult.message,
        text_preview: params.text?.substring(0, 100),
      });
      throw new Error(
        `LoopMessage API error: ${validatedResult.message || "Unknown error"}`,
      );
    }

    return validatedResult;
  }
}
