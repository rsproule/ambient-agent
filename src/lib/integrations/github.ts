/**
 * GitHub Integration Utilities
 *
 * Example utilities for working with connected GitHub accounts
 */

import { getConnection, updateConnection } from "@/src/db/connection";
import { getRefreshedAccount } from "@/src/lib/pipedream/client";
import { Octokit } from "@octokit/rest";

// Use Octokit REST API response types
export type GitHubRepo = Awaited<
  ReturnType<Octokit["rest"]["repos"]["get"]>
>["data"];
export type GitHubUser = Awaited<
  ReturnType<Octokit["rest"]["users"]["getAuthenticated"]>
>["data"];
export type GitHubPullRequest = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["get"]>
>["data"];

/**
 * Get an authenticated GitHub client, refreshing token if necessary
 */
async function getGitHubClient(userId: string): Promise<Octokit> {
  const connection = await getConnection(userId, "github");

  if (!connection || connection.status !== "connected") {
    throw new Error("GitHub not connected");
  }

  // GitHub tokens don't typically expire, but we refresh if needed
  if (connection.expiresAt && new Date() > connection.expiresAt) {
    if (!connection.pipedreamAccountId) {
      throw new Error("Missing Pipedream account ID");
    }

    const refreshed = await getRefreshedAccount(connection.pipedreamAccountId);

    // Extract OAuth credentials from the credentials object
    const credentials = refreshed.credentials as
      | Record<string, unknown>
      | undefined;
    const oauthAccessToken = credentials?.oauth_access_token as
      | string
      | undefined;
    const oauthRefreshToken = credentials?.oauth_refresh_token as
      | string
      | undefined;

    // Update connection with new tokens
    await updateConnection(userId, "github", {
      accessToken: oauthAccessToken,
      refreshToken: oauthRefreshToken,
      expiresAt: refreshed.expiresAt,
      lastSyncedAt: new Date(),
    });

    return new Octokit({
      auth: oauthAccessToken,
    });
  }

  if (!connection.accessToken) {
    throw new Error("No access token available");
  }

  return new Octokit({
    auth: connection.accessToken,
  });
}

/**
 * Get authenticated user's GitHub profile
 */
export async function getGitHubUser(userId: string): Promise<GitHubUser> {
  const octokit = await getGitHubClient(userId);

  const response = await octokit.users.getAuthenticated();

  return response.data as GitHubUser;
}

/**
 * List user's GitHub repositories
 */
export async function listGitHubRepos(
  userId: string,
  options?: {
    visibility?: "all" | "public" | "private";
    sort?: "created" | "updated" | "pushed" | "full_name";
    perPage?: number;
    page?: number;
  },
): Promise<GitHubRepo[]> {
  const octokit = await getGitHubClient(userId);

  const response = await octokit.repos.listForAuthenticatedUser({
    visibility: options?.visibility || "all",
    sort: options?.sort || "updated",
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return response.data as GitHubRepo[];
}

/**
 * Get a specific repository
 */
export async function getGitHubRepo(
  userId: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo> {
  const octokit = await getGitHubClient(userId);

  const response = await octokit.repos.get({
    owner,
    repo,
  });

  return response.data as GitHubRepo;
}

/**
 * List pull requests for a repository
 */
export async function listGitHubPullRequests(
  userId: string,
  owner: string,
  repo: string,
  options?: {
    state?: "open" | "closed" | "all";
    perPage?: number;
    page?: number;
  },
): Promise<GitHubPullRequest[]> {
  const octokit = await getGitHubClient(userId);

  const response = await octokit.pulls.list({
    owner,
    repo,
    state: options?.state || "open",
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return response.data as GitHubPullRequest[];
}

/**
 * Get user's recent activity summary
 */
export async function getGitHubActivitySummary(userId: string) {
  const [user, repos] = await Promise.all([
    getGitHubUser(userId),
    listGitHubRepos(userId, { sort: "updated", perPage: 5 }),
  ]);

  return {
    user: {
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url,
      public_repos: user.public_repos,
      followers: user.followers,
    },
    recentRepos: repos.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      updated_at: repo.updated_at,
    })),
  };
}
