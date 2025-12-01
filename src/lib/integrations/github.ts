/**
 * GitHub Integration Utilities
 *
 * Uses Pipedream Connect's proxy to make authenticated GitHub API calls
 * Documentation: https://pipedream.com/docs/connect/quickstart
 */

import { getConnection } from "@/src/db/connection";
import { pipedream } from "@/src/lib/pipedream/client";
import { Octokit } from "@octokit/rest";

// Use Octokit REST API response types
export type GitHubUser = Awaited<
  ReturnType<Octokit["rest"]["users"]["getAuthenticated"]>
>["data"];

export type GitHubRepo = Awaited<
  ReturnType<Octokit["rest"]["repos"]["get"]>
>["data"];

export type GitHubPullRequest = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["get"]>
>["data"];

/**
 * Get connection info for making proxied GitHub API calls
 */
async function getGitHubConnection(userId: string) {
  const connection = await getConnection(userId, "github");

  if (!connection || connection.status !== "connected") {
    throw new Error("GitHub not connected");
  }

  if (!connection.pipedreamAccountId) {
    throw new Error("Missing Pipedream account ID");
  }

  return {
    accountId: connection.pipedreamAccountId,
    externalUserId: connection.userId,
  };
}

/**
 * Make an authenticated GET request to GitHub API via Pipedream proxy
 */
async function githubProxyGet<T>(
  userId: string,
  path: string,
  params?: Record<string, string | object | string[] | object[] | null>,
): Promise<T> {
  const { accountId, externalUserId } = await getGitHubConnection(userId);

  const url = `https://api.github.com${path}`;

  const response = await pipedream.proxy.get({
    url,
    accountId,
    externalUserId,
    params,
  });

  return response as T;
}

/**
 * Get authenticated user's GitHub profile
 */
export async function getGitHubUser(userId: string): Promise<GitHubUser> {
  return githubProxyGet(userId, "/user");
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
  const params: Record<string, string | object | string[] | object[] | null> =
    {};

  if (options?.visibility) {
    params.visibility = options.visibility;
  }

  if (options?.sort) {
    params.sort = options.sort;
  }

  if (options?.perPage) {
    params.per_page = String(options.perPage);
  }

  if (options?.page) {
    params.page = String(options.page);
  }

  return githubProxyGet(userId, "/user/repos", params);
}

/**
 * Get a specific GitHub repository
 */
export async function getGitHubRepo(
  userId: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo> {
  return githubProxyGet(
    userId,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
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
  },
): Promise<GitHubPullRequest[]> {
  const params: Record<string, string | object | string[] | object[] | null> =
    {};

  if (options?.state) {
    params.state = options.state;
  }

  if (options?.perPage) {
    params.per_page = String(options.perPage);
  }

  return githubProxyGet(
    userId,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
    params,
  );
}

/**
 * Get a summary of user's GitHub activity
 */
export async function getGitHubActivitySummary(userId: string): Promise<{
  user: GitHubUser;
  recentRepos: GitHubRepo[];
}> {
  const [user, recentRepos] = await Promise.all([
    getGitHubUser(userId),
    listGitHubRepos(userId, { sort: "updated", perPage: 5 }),
  ]);

  return { user, recentRepos };
}
