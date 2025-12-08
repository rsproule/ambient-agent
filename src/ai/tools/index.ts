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
 * - Configure group chat settings
 * - Record feature requests from users
 * - Orchestrate wagers/bets in group chats
 *
 * Security: User-identity-sensitive tools are context-bound factories.
 * The phone number is taken from authenticated context, not user input,
 * preventing spoofing via prompt injection.
 */

// Context-bound tools (identity from system context, cannot be spoofed)
export { createCompleteOnboardingTool } from "./completeOnboarding";
export { createGenerateConnectionLinkTool } from "./generateConnectionLink";
export { createGetUserContextTool } from "./getUserContext";
export { createGroupChatSettingsTools } from "./groupChatSettings";
export { createRequestFeatureTool } from "./requestFeature";
export { createRequestResearchTool } from "./requestResearch";
export { createUpdateUserContextTool } from "./updateUserContext";
export { createScheduledJobTools } from "./scheduledJob";
export { createWagerTools } from "./wager";

// Static tools (no context needed - Claude can see images directly)
export { createImageTool } from "./createImage";

// Integration tools (context-bound)
export { createCalendarTools } from "./calendar";
export { createGitHubTools } from "./github";
export { createGmailTools } from "./gmail";

// Search tool (unified web + X search via xAI Grok)
export { grokSearchTool } from "./search";

// Helpers
export { getAuthenticatedUserId, hasActiveConnections } from "./helpers";
