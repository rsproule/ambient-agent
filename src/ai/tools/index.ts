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

export { createImageTool } from "./createImage";
export { generateConnectionLinkTool } from "./generateConnectionLink";
export { getConversationConfigTool } from "./getConversationConfig";
export { getUserContextTool } from "./getUserContext";
export { updateConversationConfigTool } from "./updateConversationConfig";
export { updateUserContextTool } from "./updateUserContext";

// Integration tools (context-bound)
export { createCalendarTools } from "./calendar";
export { createGitHubTools } from "./github";
export { createGmailTools } from "./gmail";

// Helpers
export { getAuthenticatedUserId, hasActiveConnections } from "./helpers";
