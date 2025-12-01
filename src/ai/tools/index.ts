/**
 * AI Tools for Agent Access
 * 
 * This module exports all available tools that AI agents can use to:
 * - Read and update conversation configuration (prioritization settings)
 * - Read and update user context and preferences
 * - Generate magic links for account connections
 * - Create images
 * - Access integrated services (Gmail, GitHub, Calendar) via OAuth
 */

export { getConversationConfigTool } from "./getConversationConfig";
export { updateConversationConfigTool } from "./updateConversationConfig";
export { getUserContextTool } from "./getUserContext";
export { updateUserContextTool } from "./updateUserContext";
export { createImageTool } from "./createImage";
export { generateConnectionLinkTool } from "./generateConnectionLink";

// Integration tools (context-bound)
export { createGmailTools } from "./gmail";
export { createGitHubTools } from "./github";
export { createCalendarTools } from "./calendar";

// Helpers
export { hasActiveConnections, getAuthenticatedUserId } from "./helpers";

