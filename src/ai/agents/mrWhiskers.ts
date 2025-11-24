import {
  getConversationConfigTool,
  getUserContextTool,
  updateConversationConfigTool,
  updateUserContextTool,
} from "@/src/ai/tools";
import { IMessageResponseSchema } from "@/src/lib/loopmessage-sdk/actions";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAgent } from "./factory";
import { mrWhiskersPersonality } from "./personalities";

const anthropic = createAnthropic({
  apiKey: process.env.ECHO_API_KEY,
  baseURL: "https://echo.router.merit.systems",
});

/**
 * Mr Whiskers - A cat trying to be an executive assistant
 *
 * This agent generates iMessage actions (messages and reactions)
 * based on conversation context.
 *
 * Has access to tools:
 * - getConversationConfig: Check current prioritization settings
 * - updateConversationConfig: Update prioritization settings for incoming messages
 * - getUserContext: Retrieve stored user preferences and context
 * - updateUserContext: Store user preferences and context
 */
export const mrWhiskersAgent = createAgent({
  personality: mrWhiskersPersonality,
  model: anthropic("claude-haiku-4-5-20251001"),
  schema: IMessageResponseSchema,
  tools: {
    getConversationConfig: getConversationConfigTool,
    updateConversationConfig: updateConversationConfigTool,
    getUserContext: getUserContextTool,
    updateUserContext: updateUserContextTool,
  },
});
