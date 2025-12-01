/**
 * GitHub Hook
 *
 * Checks for recent PR activity (reviews needed, mentions, etc.)
 */

import {
  getGitHubUser,
  listGitHubPullRequests,
  listGitHubRepos,
} from "@/src/lib/integrations/github";
import type { HookContext, HookResult } from "../types";

/**
 * Check for GitHub activity requiring attention
 */
export async function checkGitHub(context: HookContext): Promise<HookResult> {
  // Skip if GitHub not connected
  if (!context.connections.github) {
    return { shouldNotify: false };
  }

  try {
    // Get user's GitHub profile
    const user = await getGitHubUser(context.userId);
    const username = user.login;

    // Get recently updated repos
    const repos = await listGitHubRepos(context.userId, {
      sort: "updated",
      perPage: 5,
    });

    // Check for open PRs that might need attention
    const prNotifications: Array<{
      repo: string;
      title: string;
      number: number;
      type: "review_requested" | "author" | "mentioned";
    }> = [];

    for (const repo of repos.slice(0, 3)) {
      // Limit API calls
      try {
        const prs = await listGitHubPullRequests(
          context.userId,
          repo.owner?.login || username,
          repo.name,
          { state: "open", perPage: 10 },
        );

        for (const pr of prs) {
          // Check if user is requested reviewer
          const isRequestedReviewer = pr.requested_reviewers?.some(
            (reviewer) => "login" in reviewer && reviewer.login === username,
          );

          // Check if user is the author
          const isAuthor = pr.user?.login === username;

          if (isRequestedReviewer) {
            prNotifications.push({
              repo: repo.full_name || repo.name,
              title: pr.title || "Untitled PR",
              number: pr.number,
              type: "review_requested",
            });
          } else if (isAuthor && pr.requested_reviewers?.length === 0) {
            // Author's PR with no reviewers - might need attention
            prNotifications.push({
              repo: repo.full_name || repo.name,
              title: pr.title || "Untitled PR",
              number: pr.number,
              type: "author",
            });
          }
        }
      } catch {
        // Skip repos we can't access
        continue;
      }
    }

    if (prNotifications.length === 0) {
      return { shouldNotify: false };
    }

    // Filter to PRs we haven't notified about
    const newNotifications = prNotifications.filter((pr) => {
      const signature = `github:pr:${pr.repo}:${pr.number}`;
      const alreadyNotified = context.recentMessages.some(
        (msg) =>
          typeof msg.content === "string" && msg.content.includes(signature),
      );
      return !alreadyNotified;
    });

    if (newNotifications.length === 0) {
      return { shouldNotify: false };
    }

    // Build notification message
    const notification = newNotifications[0];
    const signature = `github:pr:${notification.repo}:${notification.number}`;

    let message: string;
    if (notification.type === "review_requested") {
      message =
        `[SYSTEM: Proactive GitHub notification - share with user naturally]\n` +
        `[${signature}]\n` +
        `You've been requested to review a PR: "${notification.title}" in ${notification.repo} (#${notification.number})`;
    } else {
      message =
        `[SYSTEM: Proactive GitHub notification - share with user naturally]\n` +
        `[${signature}]\n` +
        `Your PR "${notification.title}" in ${notification.repo} (#${notification.number}) is open`;
    }

    return {
      shouldNotify: true,
      message,
      contentSignature: signature,
      metadata: {
        repo: notification.repo,
        prNumber: notification.number,
        type: notification.type,
        totalPending: newNotifications.length,
      },
    };
  } catch (error) {
    console.error("[checkGitHub] Error checking GitHub:", error);
    return { shouldNotify: false };
  }
}
