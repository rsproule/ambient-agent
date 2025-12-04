/**
 * Twitter Hook
 *
 * Checks the user's Twitter home timeline for interesting content
 * and poses engaging questions to spark conversation.
 */

import { getTwitterFeedSummary, type TweetV2, type UserV2 } from "@/src/lib/integrations/twitter";
import type { HookContext, HookResult } from "../types";

/**
 * Analyze tweets to find the most interesting/engaging content
 * This is a simple heuristic - looks for engagement signals
 */
function findInterestingTweet(
  tweets: TweetV2[],
  authors: Map<string, UserV2>,
): {
  tweet: TweetV2;
  author: UserV2 | null;
  engagementScore: number;
} | null {
  if (!tweets.length) return null;

  // Score tweets based on engagement and recency
  const scoredTweets = tweets.map((tweet) => {
    const metrics = tweet.public_metrics;
    let score = 0;

    if (metrics) {
      // Weight different engagement types
      score += metrics.like_count * 1;
      score += metrics.retweet_count * 3;
      score += metrics.reply_count * 2;
      score += metrics.quote_count * 4;
    }

    // Boost for verified authors
    const author = tweet.author_id ? authors.get(tweet.author_id) ?? null : null;
    if (author?.verified) {
      score *= 1.5;
    }

    // Filter out very short tweets or ones that look like spam
    if (tweet.text.length < 20 || tweet.text.includes("http") && tweet.text.length < 50) {
      score *= 0.5;
    }

    return { tweet, author, engagementScore: score };
  });

  // Sort by score and get the top one
  scoredTweets.sort((a, b) => b.engagementScore - a.engagementScore);
  return scoredTweets[0];
}

/**
 * Check the user's Twitter feed for interesting content
 */
export async function checkTwitter(context: HookContext): Promise<HookResult> {
  // Skip if Twitter not connected
  if (!context.connections.twitter) {
    return { shouldNotify: false };
  }

  try {
    // Get the user's feed
    const { recentTweets, authors } = await getTwitterFeedSummary(context.userId);

    if (!recentTweets.length) {
      return { shouldNotify: false };
    }

    // Find the most interesting tweet
    const interesting = findInterestingTweet(recentTweets, authors);

    if (!interesting || interesting.engagementScore < 10) {
      // Not interesting enough to bother the user
      return { shouldNotify: false };
    }

    const { tweet, author } = interesting;

    // Create a unique signature for this tweet to avoid duplicate notifications
    const signature = `twitter:feed:${tweet.id}`;

    // Check if we've already notified about this tweet
    const alreadyNotified = context.recentMessages.some(
      (msg) => msg.content.includes(signature),
    );

    if (alreadyNotified) {
      return { shouldNotify: false };
    }

    // Build the notification message
    const authorDisplay = author
      ? `@${author.username}${author.verified ? " ✓" : ""}`
      : "someone in your feed";

    // Truncate long tweets
    const tweetText =
      tweet.text.length > 200 ? tweet.text.substring(0, 200) + "..." : tweet.text;

    const message =
      `[SYSTEM: Proactive Twitter notification - share with user naturally and spark discussion]\n` +
      `[${signature}]\n` +
      `Interesting tweet from ${authorDisplay}:\n` +
      `"${tweetText}"\n\n` +
      `This tweet is getting attention in your feed. Consider asking the user what they think about it ` +
      `or if they want to engage with it. Keep it conversational and natural.`;

    return {
      shouldNotify: true,
      message,
      contentSignature: signature,
      metadata: {
        tweetId: tweet.id,
        author: authorDisplay,
        engagementScore: interesting.engagementScore,
        metrics: tweet.public_metrics,
      },
    };
  } catch (error) {
    console.error("[checkTwitter] Error checking Twitter feed:", error);
    return { shouldNotify: false };
  }
}

