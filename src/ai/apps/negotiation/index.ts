import type { AppDefinition } from "../types";
import { negotiationAgent } from "./agent";
import { NEGOTIATION_PROMPT } from "./prompt";

/**
 * Negotiation App
 *
 * Activated for new users during onboarding.
 * Researches the user and negotiates their signup bonus.
 */
export const negotiationApp: AppDefinition = {
  id: "negotiation",
  name: "Onboarding Negotiation",
  description:
    "Onboard new users while learning about them and negotiating their signup bonus",

  allowedTools: [
    // Context
    "getUserContext",
    "updateUserContext",
    // App control
    "switchApp",
    // Research
    "search",
    "requestResearch",
    "generateConnectionLink",
    // Gmail read
    "gmail_search",
    "gmail_get_message",
    "gmail_list_recent",
    // GitHub read
    "github_get_profile",
    "github_list_repos",
    "github_get_repo",
    "github_list_pull_requests",
    "github_get_activity",
    // Calendar read
    "calendar_list_events",
    "calendar_get_today",
    "calendar_get_week",
  ],

  systemPrompt: NEGOTIATION_PROMPT,

  shouldActivate: (context) => {
    // Auto-activate for new users in onboarding
    return context.systemState?.isOnboarding === true;
  },
  agent: negotiationAgent,
};
