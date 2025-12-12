/**
 * Claude Task Tool for AI Agent
 *
 * Executes coding tasks in the user's persistent workspace using Claude.
 * Handles workspace creation inline if needed.
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
import { executeClaudeTask } from "@/src/trigger/tasks/executeClaudeTask";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create claude task tool bound to a conversation context
 */
export function createClaudeTaskTool(context: ConversationContext) {
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Execute a coding task using Claude in the user's persistent GitHub workspace. " +
      "Claude will work on the task and can message the user with progress updates. " +
      "If the user doesn't have a workspace yet, provide workspace_name to create one first. " +
      "Use this for coding, scripting, building tools, or any task that benefits from file persistence.",
    inputSchema: zodSchema(
      z.object({
        task: z
          .string()
          .describe(
            "The coding task to execute. Be specific about what to build/create.",
          ),
        workspace_name: z
          .string()
          .optional()
          .describe(
            "REQUIRED if user has no workspace yet. Name for their new workspace " +
              "(letters, numbers, - and _ only, 2-39 characters).",
          ),
      }),
    ),
    execute: async ({ task, workspace_name }) => {
      try {
        if (!authenticatedPhone) {
          return {
            success: false,
            message: "Could not identify user. Please try again.",
          };
        }

        // Get user from phone
        const user = await getUserByPhoneNumber(authenticatedPhone);
        if (!user) {
          return {
            success: false,
            message: "User not found. Please set up your account first.",
          };
        }

        // Check for existing workspace
        let workspaceUsername = await getWorkspaceUsername(user.id);

        // If no workspace, try to create one
        if (!workspaceUsername) {
          if (!workspace_name) {
            return {
              success: false,
              needsWorkspace: true,
              message:
                "You don't have a workspace yet. Ask the user what they'd like to name " +
                "their workspace (it will be their GitHub repo at MeritSpace/{name}), " +
                "then call this tool again with workspace_name set.",
            };
          }

          // Validate and create workspace
          const normalized = workspace_name.toLowerCase();

          if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
            return {
              success: false,
              message:
                "Invalid workspace name. Use only letters, numbers, underscores, and hyphens.",
            };
          }

          if (normalized.length < 2 || normalized.length > 39) {
            return {
              success: false,
              message: "Workspace name must be between 2 and 39 characters.",
            };
          }

          // Check availability
          const isAvailable = await isWorkspaceUsernameAvailable(normalized);
          if (!isAvailable) {
            return {
              success: false,
              message: `"${normalized}" is already taken. Try a different name.`,
            };
          }

          // Create GitHub repo
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
          workspaceUsername = normalized;
        }

        // Generate a unique request ID for this task
        const requestId = `claude-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

        // Trigger the Claude task execution
        await executeClaudeTask.trigger({
          requestId,
          task,
          workspaceUsername,
          conversationId: context.conversationId,
          recipient: context.isGroup ? undefined : context.conversationId,
          group: context.isGroup ? context.conversationId : undefined,
          userId: user.id,
        });

        return {
          success: true,
          taskId: requestId,
          workspaceUsername,
          repoUrl: getWorkspaceRepoUrl(workspaceUsername),
          message:
            `Task started! Claude is now working on this in your workspace (MeritSpace/${workspaceUsername}). ` +
            `You'll receive updates as progress is made.`,
        };
      } catch (error) {
        console.error("[claudeTask] Error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to start task",
        };
      }
    },
  });
}
