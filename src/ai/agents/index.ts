/**
 * Agent exports
 * 
 * This module provides access to all available agents.
 * Agents are composable personality/behavior configurations
 * that can be used with the respondToMessage function.
 */

export { type Agent } from "./types";
export { mrWhiskersAgent } from "./mrWhiskers";

// Export personality types and configurations
export { type AgentPersonality } from "./personalities";
export { mrWhiskersPersonality } from "./personalities";

// Export system prompt utilities
export { IMESSAGE_SYSTEM_PROMPT, buildConversationContextPrompt } from "./systemPrompt";

// Export factory utilities for creating new agents
export { createAgent, buildFullInstructions, defaultBuildContext } from "./factory";

// Add more agents here as needed
// export { anotherAgent } from "./anotherAgent";

