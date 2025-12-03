import { createImageTool } from "@/src/ai/tools";
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
 * NOTE: This agent includes static tools (createImage, webSearch).
 * Context-bound tools (getUserContext, updateUserContext, scheduledJobs, etc.)
 * are added dynamically in respondToMessage based on the conversation context.
 * 
 * createImage is static because Claude can now SEE images in the conversation
 * (they're prepended as visual context), so it knows which URL to pass.
 */
export const mrWhiskersAgent = createAgent({
  personality: mrWhiskersPersonality,
  model: anthropic("claude-haiku-4-5-20251001"),
  schema: IMessageResponseSchema,
  tools: {
    // Static tools
    createImage: createImageTool,
    webSearch: webSearchPerplexityTool,
  },
});
