/**
 * Twitter/X Integration Utilities
 *
 * Uses Pipedream Connect's proxy to make authenticated Twitter API calls
 * Documentation: https://pipedream.com/docs/connect/quickstart
 */

import { getConnection } from "@/src/db/connection";
import { pipedream } from "@/src/lib/pipedream/client";
import type { ApiV2Includes, TweetV2, UserV2 } from "twitter-api-v2";

// Re-export SDK types for convenience
export type { ApiV2Includes, TweetV2, UserV2 } from "twitter-api-v2";

// Response wrapper types (the SDK types are for the data, we need wrappers for API responses)
export interface TwitterApiResponse<T> {
  data: T;
  includes?: ApiV2Includes;
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count?: number;
    next_token?: string;
    previous_token?: string;
  };
}

export type TwitterUserResponse = TwitterApiResponse<UserV2>;
export type TwitterUsersResponse = TwitterApiResponse<UserV2[]>;
export type TwitterTweetsResponse = TwitterApiResponse<TweetV2[]>;

/**
 * Get connection info for making proxied Twitter API calls
 */
async function getTwitterConnection(userId: string) {
  const connection = await getConnection(userId, "twitter");

  if (!connection || connection.status !== "connected") {
    throw new Error("Twitter not connected");
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
 * Make an authenticated GET request to Twitter API via Pipedream proxy
 */
async function twitterProxyGet<T>(
  userId: string,
  path: string,
  params?: Record<string, string | string[] | undefined>,
): Promise<T> {
  const { accountId, externalUserId } = await getTwitterConnection(userId);

  const url = `https://api.twitter.com/2${path}`;

  // Filter out undefined values and convert arrays to comma-separated strings
  const cleanParams: Record<string, string> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        cleanParams[key] = Array.isArray(value) ? value.join(",") : value;
      }
    }
  }

  const response = await pipedream.proxy.get({
    url,
    accountId,
    externalUserId,
    params: cleanParams,
  });

  return response as T;
}

/**
 * Get the authenticated user's Twitter profile
 */
export async function getTwitterUser(userId: string): Promise<UserV2> {
  const response = await twitterProxyGet<TwitterUserResponse>(
    userId,
    "/users/me",
    {
      "user.fields": [
        "id",
        "name",
        "username",
        "description",
        "profile_image_url",
        "public_metrics",
        "verified",
        "verified_type",
        "created_at",
        "location",
        "url",
      ],
    },
  );

  return response.data;
}

/**
 * Get a Twitter user's profile by username
 */
export async function getUserProfile(
  userId: string,
  username: string,
): Promise<UserV2> {
  const response = await twitterProxyGet<TwitterUserResponse>(
    userId,
    `/users/by/username/${encodeURIComponent(username)}`,
    {
      "user.fields": [
        "id",
        "name",
        "username",
        "description",
        "profile_image_url",
        "public_metrics",
        "verified",
        "verified_type",
        "created_at",
        "location",
        "url",
      ],
    },
  );

  return response.data;
}

/**
 * Get the user's home timeline (tweets from accounts they follow)
 */
export async function getHomeTimeline(
  userId: string,
  options?: {
    maxResults?: number;
    paginationToken?: string;
  },
): Promise<TwitterTweetsResponse> {
  // First get the authenticated user's ID
  const user = await getTwitterUser(userId);

  const response = await twitterProxyGet<TwitterTweetsResponse>(
    userId,
    `/users/${user.id}/timelines/reverse_chronological`,
    {
      max_results: String(Math.min(options?.maxResults || 20, 100)),
      pagination_token: options?.paginationToken,
      "tweet.fields": [
        "id",
        "text",
        "author_id",
        "created_at",
        "public_metrics",
        "entities",
        "attachments",
      ],
      "user.fields": [
        "id",
        "name",
        "username",
        "profile_image_url",
        "verified",
      ],
      expansions: ["author_id", "attachments.media_keys"],
      "media.fields": ["media_key", "type", "url", "preview_image_url"],
    },
  );

  return response;
}

/**
 * Search for tweets
 */
export async function searchTweets(
  userId: string,
  query: string,
  options?: {
    maxResults?: number;
    sortOrder?: "recency" | "relevancy";
  },
): Promise<TwitterTweetsResponse> {
  const response = await twitterProxyGet<TwitterTweetsResponse>(
    userId,
    "/tweets/search/recent",
    {
      query,
      max_results: String(Math.min(options?.maxResults || 20, 100)),
      sort_order: options?.sortOrder || "relevancy",
      "tweet.fields": [
        "id",
        "text",
        "author_id",
        "created_at",
        "public_metrics",
        "entities",
        "attachments",
      ],
      "user.fields": [
        "id",
        "name",
        "username",
        "profile_image_url",
        "verified",
      ],
      expansions: ["author_id", "attachments.media_keys"],
      "media.fields": ["media_key", "type", "url", "preview_image_url"],
    },
  );

  return response;
}

/**
 * Get user's recent tweets
 */
export async function getUserTweets(
  userId: string,
  targetUserId: string,
  options?: {
    maxResults?: number;
  },
): Promise<TwitterTweetsResponse> {
  const response = await twitterProxyGet<TwitterTweetsResponse>(
    userId,
    `/users/${targetUserId}/tweets`,
    {
      max_results: String(Math.min(options?.maxResults || 10, 100)),
      "tweet.fields": [
        "id",
        "text",
        "author_id",
        "created_at",
        "public_metrics",
        "entities",
        "attachments",
      ],
      "user.fields": [
        "id",
        "name",
        "username",
        "profile_image_url",
        "verified",
      ],
      expansions: ["author_id", "attachments.media_keys"],
      "media.fields": ["media_key", "type", "url", "preview_image_url"],
    },
  );

  return response;
}

/**
 * Get a summary of the user's Twitter feed
 * Useful for the proactive hook
 */
export async function getTwitterFeedSummary(userId: string): Promise<{
  user: UserV2;
  recentTweets: TweetV2[];
  authors: Map<string, UserV2>;
}> {
  const [user, timeline] = await Promise.all([
    getTwitterUser(userId),
    getHomeTimeline(userId, { maxResults: 20 }),
  ]);

  // Build a map of author_id -> user for easy lookup
  const authors = new Map<string, UserV2>();
  if (timeline.includes?.users) {
    for (const author of timeline.includes.users) {
      authors.set(author.id, author);
    }
  }

  return {
    user,
    recentTweets: timeline.data || [],
    authors,
  };
}
