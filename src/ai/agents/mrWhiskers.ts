import { webSearchPerplexityTool } from "@/src/components/ai-tools/websearch/tool";
import { IMessageResponseSchema } from "@/src/lib/loopmessage-sdk/actions";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAgent } from "./factory";
import { mrWhiskersPersonality } from "./personalities";

const anthropic = createAnthropic({
  apiKey: process.env.ECHO_API_KEY,
  baseURL: "https://echo.router.merit.systems",
});

/**
 * Base Mr. Whiskers agent configuration.
 *
 * NOTE: This agent only includes static tools (webSearch).
 * Context-bound tools (getUserContext, updateUserContext, createImage, scheduledJobs, etc.)
 * are added dynamically in respondToMessage based on the conversation context.
 * This ensures user identity comes from system context (cannot be spoofed)
 * and createImage can access conversation attachments.
 */
export const mrWhiskersAgent = createAgent({
  personality: mrWhiskersPersonality,
  model: anthropic("claude-haiku-4-5-20251001"),
  schema: IMessageResponseSchema,
  tools: {
    // Static tools (no user identity needed)
    webSearch: webSearchPerplexityTool,
  },
});
