import {
  createImageTool,
  generateConnectionLinkTool,
  getConversationConfigTool,
  getUserContextTool,
  updateConversationConfigTool,
  updateUserContextTool,
} from "@/src/ai/tools";
import { webSearchPerplexityTool } from "@/src/components/ai-tools/websearch/tool";
import { IMessageResponseSchema } from "@/src/lib/loopmessage-sdk/actions";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAgent } from "./factory";
import { mrWhiskersPersonality } from "./personalities";

const anthropic = createAnthropic({
  // apiKey: process.env.ECHO_API_KEY,
  // baseURL: "https://echo.router.merit.systems",
});

export const mrWhiskersAgent = createAgent({
  personality: mrWhiskersPersonality,
  model: anthropic("claude-haiku-4-5-20251001"),
  schema: IMessageResponseSchema,
  tools: {
    // Conversation configuration tools
    getConversationConfig: getConversationConfigTool,
    updateConversationConfig: updateConversationConfigTool,
    getUserContext: getUserContextTool,
    updateUserContext: updateUserContextTool,

    // Account connection tools
    generateConnectionLink: generateConnectionLinkTool,

    // normalchatbot tools
    createImage: createImageTool,
    webSearch: webSearchPerplexityTool,
  },
});
