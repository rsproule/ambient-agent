/**
 * AI Tools for Agent Access
 *
 * This module exports all available tools that AI agents can use to:
 * - Read and update user context and preferences
 * - Request deep research on users
 * - Generate magic links for account connections
 * - Create images
 * - Access integrated services (Gmail, GitHub, Calendar) via OAuth
 * - Create and manage scheduled jobs
 */

export { createImageTool } from "./createImage";
export { generateConnectionLinkTool } from "./generateConnectionLink";
export { getUserContextTool } from "./getUserContext";
export { requestResearchTool } from "./requestResearch";
export { updateUserContextTool } from "./updateUserContext";

// Scheduled job tools
export {
  createScheduledJobTool,
  deleteScheduledJobTool,
  listScheduledJobsTool,
  toggleScheduledJobTool,
} from "./scheduledJob";

// Integration tools (context-bound)
export { createCalendarTools } from "./calendar";
export { createGitHubTools } from "./github";
export { createGmailTools } from "./gmail";

// Helpers
export { getAuthenticatedUserId, hasActiveConnections } from "./helpers";
