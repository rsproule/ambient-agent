import {
  createImageTool,
  getConversationConfigTool,
  getUserContextTool,
  updateConversationConfigTool,
  updateUserContextTool,
} from "@/src/ai/tools";
import { IMessageResponseSchema } from "@/src/lib/loopmessage-sdk/actions";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAgent } from "./factory";
import { mrWhiskersPersonality } from "./personalities";
import { webSearchPerplexityTool } from "@/src/components/ai-tools/websearch/tool";

const anthropic = createAnthropic({
  // apiKey: process.env.ECHO_API_KEY,
  // baseURL: "https://echo.router.merit.systems",
});

export const mrWhiskersAgent = createAgent({
  personality: mrWhiskersPersonality,
  model: anthropic("claude-haiku-4-5-20251001"),
  schema: IMessageResponseSchema,
  tools: {
    getConversationConfig: getConversationConfigTool,
    updateConversationConfig: updateConversationConfigTool,
    getUserContext: getUserContextTool,
    updateUserContext: updateUserContextTool,
    createImage: createImageTool,
    // native anthropic tools - disabled for now
    webSearch: webSearchPerplexityTool,
    // webSearch: webSearchTool,
    // web_fetch: webFetchTool,
  },
});
