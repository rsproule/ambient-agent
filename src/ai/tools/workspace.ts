/**
 * Workspace Tool for AI Agent
 *
 * Allows users to claim a workspace username via conversation.
 * The workspace is a persistent GitHub repo at MeritSpace/{username}.
 */

import type { ConversationContext } from "@/src/db/conversation";
import {
  claimWorkspaceUsername,
  getUserByPhoneNumber,
  getWorkspaceUsername,
  isWorkspaceUsernameAvailable,
} from "@/src/db/user";
import {
  createWorkspaceRepo,
  getWorkspaceRepoUrl,
} from "@/src/lib/integrations/workspace";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create workspace tools bound to a conversation context
 */
export function createWorkspaceTools(context: ConversationContext) {
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return {
    workspace_check_username: tool({
      description:
        "Check if a workspace username is available. " +
        "Use this before claiming to verify the username isn't taken.",
      inputSchema: zodSchema(
        z.object({
          username: z
            .string()
            .describe("The username to check (letters, numbers, - and _ only)"),
        }),
      ),
      execute: async ({ username }) => {
        try {
          const normalized = username.toLowerCase();

          // Validate format
          if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
            return {
              available: false,
              reason:
                "Invalid characters. Use only letters, numbers, underscores, and hyphens.",
            };
          }

          if (normalized.length < 2 || normalized.length > 39) {
            return {
              available: false,
              reason: "Username must be between 2 and 39 characters.",
            };
          }

          const isAvailable = await isWorkspaceUsernameAvailable(normalized);

          return {
            available: isAvailable,
            username: normalized,
            message: isAvailable
              ? `"${normalized}" is available!`
              : `"${normalized}" is already taken.`,
          };
        } catch (error) {
          return {
            available: false,
            reason:
              error instanceof Error
                ? error.message
                : "Failed to check availability",
          };
        }
      },
    }),

    workspace_claim: tool({
      description:
        "Claim a workspace username for the user. " +
        "This creates a persistent GitHub repository at MeritSpace/{username} " +
        "that Claude can use for coding tasks. " +
        "The user can only claim one workspace. " +
        "Check availability first with workspace_check_username.",
      inputSchema: zodSchema(
        z.object({
          username: z
            .string()
            .describe("The username to claim (letters, numbers, - and _ only)"),
        }),
      ),
      execute: async ({ username }) => {
        try {
          if (!authenticatedPhone) {
            return {
              success: false,
              message: "Could not identify user. Please try again.",
            };
          }

          // Get user ID from phone
          const user = await getUserByPhoneNumber(authenticatedPhone);
          if (!user) {
            return {
              success: false,
              message: "User not found. Please set up your account first.",
            };
          }

          // Check if already has workspace
          const existing = await getWorkspaceUsername(user.id);
          if (existing) {
            return {
              success: false,
              alreadyClaimed: true,
              workspaceUsername: existing,
              repoUrl: getWorkspaceRepoUrl(existing),
              message: `You already have a workspace: MeritSpace/${existing}`,
            };
          }

          const normalized = username.toLowerCase();

          // Validate format
          if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
            return {
              success: false,
              message:
                "Invalid username. Use only letters, numbers, underscores, and hyphens.",
            };
          }

          if (normalized.length < 2 || normalized.length > 39) {
            return {
              success: false,
              message: "Username must be between 2 and 39 characters.",
            };
          }

          // Check availability
          const isAvailable = await isWorkspaceUsernameAvailable(normalized);
          if (!isAvailable) {
            return {
              success: false,
              message: `"${normalized}" is already taken. Try a different username.`,
            };
          }

          // Create GitHub repo with default structure
          const repoResult = await createWorkspaceRepo(normalized);
          if (!repoResult.success) {
            return {
              success: false,
              message:
                repoResult.error || "Failed to create workspace repository.",
            };
          }

          // Claim in database
          await claimWorkspaceUsername(user.id, normalized);

          return {
            success: true,
            workspaceUsername: normalized,
            repoUrl: getWorkspaceRepoUrl(normalized),
            message:
              `Workspace claimed! Your persistent workspace is now at MeritSpace/${normalized}. ` +
              `I can use this for coding tasks, and all changes will be saved to GitHub.`,
          };
        } catch (error) {
          return {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Failed to claim workspace",
          };
        }
      },
    }),

    workspace_get: tool({
      description:
        "Get the user's current workspace information. " +
        "Returns their workspace username and GitHub repo URL if they have one.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        try {
          if (!authenticatedPhone) {
            return {
              success: false,
              message: "Could not identify user.",
            };
          }

          const user = await getUserByPhoneNumber(authenticatedPhone);
          if (!user) {
            return {
              success: false,
              message: "User not found.",
            };
          }

          const workspaceUsername = await getWorkspaceUsername(user.id);

          if (!workspaceUsername) {
            return {
              success: true,
              hasWorkspace: false,
              message:
                "You don't have a workspace yet. Would you like to claim one?",
            };
          }

          return {
            success: true,
            hasWorkspace: true,
            workspaceUsername,
            repoUrl: getWorkspaceRepoUrl(workspaceUsername),
            message: `Your workspace is MeritSpace/${workspaceUsername}`,
          };
        } catch (error) {
          return {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Failed to get workspace info",
          };
        }
      },
    }),
  };
}
