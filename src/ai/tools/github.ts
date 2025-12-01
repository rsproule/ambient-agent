/**
 * GitHub Integration Tool for AI Agent
 *
 * Provides GitHub access for authenticated users via AI SDK tool interface.
 * In group messages, always authenticates as the message sender.
 */

import type { ConversationContext } from "@/src/db/conversation";
import {
  getGitHubActivitySummary,
  getGitHubRepo,
  getGitHubUser,
  listGitHubPullRequests,
  listGitHubRepos,
} from "@/src/lib/integrations/github";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { getAuthenticatedUserId } from "./helpers";

/**
 * Create GitHub tools bound to a specific conversation context
 */
export function createGitHubTools(context: ConversationContext) {
  return {
    github_get_profile: tool({
      description:
        "Get the authenticated user's GitHub profile information. " +
        "Only available if the user has connected their GitHub account.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access GitHub in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const user = await getGitHubUser(userId);

          return {
            success: true,
            profile: {
              login: user.login,
              name: user.name,
              bio: user.bio,
              avatar_url: user.avatar_url,
              public_repos: user.public_repos,
              followers: user.followers,
              following: user.following,
              created_at: user.created_at,
            },
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "GitHub is not connected. The user needs to connect their GitHub account first.",
            };
          }

          return {
            success: false,
            message: `Failed to get GitHub profile: ${errorMessage}`,
          };
        }
      },
    }),

    github_list_repos: tool({
      description:
        "List the user's GitHub repositories. " +
        "Only available if the user has connected their GitHub account.",
      inputSchema: zodSchema(
        z.object({
          visibility: z
            .enum(["all", "public", "private"])
            .optional()
            .describe('Repository visibility filter (default: "all")'),
          sort: z
            .enum(["created", "updated", "pushed", "full_name"])
            .optional()
            .describe('Sort order (default: "updated")'),
          perPage: z
            .number()
            .optional()
            .describe("Number of repos to return (default: 10, max: 100)"),
        }),
      ),
      execute: async ({ visibility, sort, perPage }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access GitHub in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const repos = await listGitHubRepos(userId, {
            visibility,
            sort,
            perPage: Math.min(perPage || 10, 100),
          });

          return {
            success: true,
            message: `Found ${repos.length} repositories`,
            repositories: repos.map((repo) => ({
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              url: repo.html_url,
              language: repo.language,
              stargazers_count: repo.stargazers_count,
              forks_count: repo.forks_count,
              open_issues_count: repo.open_issues_count,
              private: repo.private,
              updated_at: repo.updated_at,
            })),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "GitHub is not connected. The user needs to connect their GitHub account first.",
            };
          }

          return {
            success: false,
            message: `Failed to list GitHub repositories: ${errorMessage}`,
          };
        }
      },
    }),

    github_get_repo: tool({
      description:
        "Get detailed information about a specific GitHub repository. " +
        "Only available if the user has connected their GitHub account.",
      inputSchema: zodSchema(
        z.object({
          owner: z.string().describe("Repository owner (username or org)"),
          repo: z.string().describe("Repository name"),
        }),
      ),
      execute: async ({ owner, repo }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access GitHub in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const repository = await getGitHubRepo(userId, owner, repo);

          return {
            success: true,
            repository: {
              name: repository.name,
              full_name: repository.full_name,
              description: repository.description,
              url: repository.html_url,
              language: repository.language,
              stargazers_count: repository.stargazers_count,
              forks_count: repository.forks_count,
              open_issues_count: repository.open_issues_count,
              private: repository.private,
              created_at: repository.created_at,
              updated_at: repository.updated_at,
              pushed_at: repository.pushed_at,
              default_branch: repository.default_branch,
              topics: repository.topics,
            },
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "GitHub is not connected. The user needs to connect their GitHub account first.",
            };
          }

          return {
            success: false,
            message: `Failed to get GitHub repository: ${errorMessage}`,
          };
        }
      },
    }),

    github_list_pull_requests: tool({
      description:
        "List pull requests for a GitHub repository. " +
        "Only available if the user has connected their GitHub account.",
      inputSchema: zodSchema(
        z.object({
          owner: z.string().describe("Repository owner (username or org)"),
          repo: z.string().describe("Repository name"),
          state: z
            .enum(["open", "closed", "all"])
            .optional()
            .describe('PR state filter (default: "open")'),
          perPage: z
            .number()
            .optional()
            .describe("Number of PRs to return (default: 10, max: 100)"),
        }),
      ),
      execute: async ({ owner, repo, state, perPage }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access GitHub in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const pullRequests = await listGitHubPullRequests(
            userId,
            owner,
            repo,
            {
              state,
              perPage: Math.min(perPage || 10, 100),
            },
          );

          return {
            success: true,
            message: `Found ${pullRequests.length} pull request(s)`,
            pull_requests: pullRequests.map((pr) => ({
              number: pr.number,
              title: pr.title,
              state: pr.state,
              user: pr.user?.login,
              created_at: pr.created_at,
              updated_at: pr.updated_at,
              html_url: pr.html_url,
              draft: pr.draft,
            })),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "GitHub is not connected. The user needs to connect their GitHub account first.",
            };
          }

          return {
            success: false,
            message: `Failed to list pull requests: ${errorMessage}`,
          };
        }
      },
    }),

    github_get_activity: tool({
      description:
        "Get a summary of the user's recent GitHub activity (profile + recent repos). " +
        "Only available if the user has connected their GitHub account.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access GitHub in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const activity = await getGitHubActivitySummary(userId);

          return {
            success: true,
            activity: {
              user: activity.user,
              recentRepos: activity.recentRepos,
            },
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "GitHub is not connected. The user needs to connect their GitHub account first.",
            };
          }

          return {
            success: false,
            message: `Failed to get GitHub activity: ${errorMessage}`,
          };
        }
      },
    }),
  };
}
