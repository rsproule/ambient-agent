/**
 * Twitter Integration Tool for AI Agent
 *
 * Provides Twitter/X access for authenticated users via AI SDK tool interface.
 * In group messages, always authenticates as the message sender.
 */

import type { ConversationContext } from "@/src/db/conversation";
import {
  getTwitterUser,
  getUserProfile,
  searchTweets,
  getHomeTimeline,
  type UserV2,
} from "@/src/lib/integrations/twitter";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { getAuthenticatedUserId } from "./helpers";

/**
 * Create Twitter tools bound to a specific conversation context
 */
export function createTwitterTools(context: ConversationContext) {
  return {
    twitter_search: tool({
      description:
        "Search Twitter/X for recent tweets. PREFERRED over webSearch for: " +
        "real-time events, breaking news, trending topics, public reactions, " +
        "social commentary, live discussions, and anything where Twitter " +
        "is likely to have more immediate/relevant results. " +
        "Only available if the user has connected their Twitter account.",
      inputSchema: zodSchema(
        z.object({
          query: z
            .string()
            .min(1)
            .describe(
              "Search query. Can include operators like 'from:username', '#hashtag', '-exclude', " +
              "'lang:en', 'is:verified', 'has:media', etc.",
            ),
          maxResults: z
            .number()
            .optional()
            .describe("Number of tweets to return (default: 20, max: 100)"),
          sortOrder: z
            .enum(["recency", "relevancy"])
            .optional()
            .describe('Sort by recency or relevancy (default: "relevancy")'),
        }),
      ),
      execute: async ({ query, maxResults, sortOrder }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Twitter in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const result = await searchTweets(userId, query, {
            maxResults,
            sortOrder,
          });

          if (!result.data || result.data.length === 0) {
            return {
              success: true,
              message: "No tweets found matching your query",
              tweets: [],
            };
          }

          // Build author lookup map
          const authors = new Map<string, { name: string; username: string; verified?: boolean }>();
          if (result.includes?.users) {
            for (const user of result.includes.users) {
              authors.set(user.id, {
                name: user.name,
                username: user.username,
                verified: user.verified,
              });
            }
          }

          return {
            success: true,
            message: `Found ${result.data.length} tweets`,
            tweets: result.data.map((tweet) => {
              const author = tweet.author_id ? authors.get(tweet.author_id) : null;
              return {
                id: tweet.id,
                text: tweet.text,
                author: author
                  ? {
                      name: author.name,
                      username: `@${author.username}`,
                      verified: author.verified,
                    }
                  : null,
                created_at: tweet.created_at,
                metrics: tweet.public_metrics
                  ? {
                      likes: tweet.public_metrics.like_count,
                      retweets: tweet.public_metrics.retweet_count,
                      replies: tweet.public_metrics.reply_count,
                      quotes: tweet.public_metrics.quote_count,
                    }
                  : null,
                url: `https://twitter.com/i/status/${tweet.id}`,
              };
            }),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Twitter is not connected. The user needs to connect their Twitter account first.",
            };
          }

          return {
            success: false,
            message: `Failed to search Twitter: ${errorMessage}`,
          };
        }
      },
    }),

    twitter_read_profile: tool({
      description:
        "Get a Twitter/X user's profile information by their username. " +
        "Only available if the user has connected their Twitter account.",
      inputSchema: zodSchema(
        z.object({
          username: z
            .string()
            .min(1)
            .describe("Twitter username (without the @ symbol)"),
        }),
      ),
      execute: async ({ username }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Twitter in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          // Remove @ if provided
          const cleanUsername = username.replace(/^@/, "");
          const profile = await getUserProfile(userId, cleanUsername);

          return {
            success: true,
            profile: {
              name: profile.name,
              username: `@${profile.username}`,
              bio: profile.description,
              profile_image_url: profile.profile_image_url,
              verified: profile.verified,
              location: profile.location,
              url: profile.url,
              metrics: profile.public_metrics
                ? {
                    followers: profile.public_metrics.followers_count,
                    following: profile.public_metrics.following_count,
                    tweets: profile.public_metrics.tweet_count,
                  }
                : null,
              created_at: profile.created_at,
              twitter_url: `https://twitter.com/${profile.username}`,
            },
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Twitter is not connected. The user needs to connect their Twitter account first.",
            };
          }

          return {
            success: false,
            message: `Failed to get Twitter profile: ${errorMessage}`,
          };
        }
      },
    }),

    twitter_draft_tweet: tool({
      description:
        "Draft a tweet for the user. This does NOT post the tweet - it returns " +
        "the draft text for the user to review and post themselves. " +
        "Use this when the user wants help composing a tweet. " +
        "Only available if the user has connected their Twitter account.",
      inputSchema: zodSchema(
        z.object({
          topic: z
            .string()
            .describe("What the tweet should be about"),
          tone: z
            .enum(["casual", "professional", "humorous", "informative", "provocative"])
            .optional()
            .describe('Tone of the tweet (default: "casual")'),
          includeHashtags: z
            .boolean()
            .optional()
            .describe("Whether to include relevant hashtags (default: false)"),
          maxLength: z
            .number()
            .optional()
            .describe("Maximum character length (default: 280, Twitter's limit)"),
        }),
      ),
      execute: async ({ topic, tone = "casual", includeHashtags = false, maxLength = 280 }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Twitter in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          // Get user's Twitter profile for context
          const user = await getTwitterUser(userId);

          // Draft the tweet based on the parameters
          // Note: This is a simple draft - in a real implementation you might
          // use an AI model to generate more sophisticated drafts
          const toneGuides: Record<string, string> = {
            casual: "conversational and relaxed",
            professional: "polished and business-appropriate",
            humorous: "witty and entertaining",
            informative: "clear and educational",
            provocative: "thought-provoking and engaging",
          };

          const draftInstructions = {
            topic,
            tone: toneGuides[tone],
            includeHashtags,
            maxLength,
            username: user.username,
          };

          return {
            success: true,
            message:
              "Here's your tweet draft. Remember to review and personalize it before posting!",
            draft: {
              instructions: draftInstructions,
              note:
                "This tool provides drafting guidance. The AI will compose the tweet " +
                "based on these parameters and return it in the conversation.",
              characterLimit: maxLength,
              tip:
                tone === "provocative"
                  ? "Provocative tweets can drive engagement but be mindful of potential backlash."
                  : `A ${tone} tone works well for building authentic connections.`,
            },
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Twitter is not connected. The user needs to connect their Twitter account first.",
            };
          }

          return {
            success: false,
            message: `Failed to draft tweet: ${errorMessage}`,
          };
        }
      },
    }),

    twitter_get_feed: tool({
      description:
        "Get the user's Twitter/X home timeline (tweets from accounts they follow). " +
        "Useful for understanding what's happening in the user's Twitter world. " +
        "Only available if the user has connected their Twitter account.",
      inputSchema: zodSchema(
        z.object({
          maxResults: z
            .number()
            .optional()
            .describe("Number of tweets to return (default: 20, max: 100)"),
        }),
      ),
      execute: async ({ maxResults }) => {
        try {
          const userId = await getAuthenticatedUserId(context);

          if (!userId) {
            return {
              success: false,
              message: context.isGroup
                ? "Cannot access Twitter in group messages - sender not identified"
                : "User not found. They may need to set up their account first.",
            };
          }

          const result = await getHomeTimeline(userId, { maxResults });

          if (!result.data || result.data.length === 0) {
            return {
              success: true,
              message: "No tweets in the timeline",
              tweets: [],
            };
          }

          // Build author lookup map
          const authors = new Map<string, { name: string; username: string; verified?: boolean }>();
          if (result.includes?.users) {
            for (const user of result.includes.users) {
              authors.set(user.id, {
                name: user.name,
                username: user.username,
                verified: user.verified,
              });
            }
          }

          return {
            success: true,
            message: `Found ${result.data.length} tweets in your timeline`,
            tweets: result.data.map((tweet) => {
              const author = tweet.author_id ? authors.get(tweet.author_id) : null;
              return {
                id: tweet.id,
                text: tweet.text,
                author: author
                  ? {
                      name: author.name,
                      username: `@${author.username}`,
                      verified: author.verified,
                    }
                  : null,
                created_at: tweet.created_at,
                metrics: tweet.public_metrics
                  ? {
                      likes: tweet.public_metrics.like_count,
                      retweets: tweet.public_metrics.retweet_count,
                      replies: tweet.public_metrics.reply_count,
                    }
                  : null,
                url: `https://twitter.com/i/status/${tweet.id}`,
              };
            }),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          if (errorMessage.includes("not connected")) {
            return {
              success: false,
              message:
                "Twitter is not connected. The user needs to connect their Twitter account first.",
            };
          }

          return {
            success: false,
            message: `Failed to get Twitter feed: ${errorMessage}`,
          };
        }
      },
    }),
  };
}

