/**
 * AI Tools for Group Chat Wagering
 *
 * Allows Whiskers to orchestrate wagers/bets among friends in group chats.
 * Supports multi-participant positions with matching.
 *
 * Security: Phone number is taken from authenticated context, not user input.
 */

import type { ConversationContext } from "@/src/db/conversation";
import {
  createWager,
  placePosition,
  resolveWager,
  cancelWager,
  getActiveWagersForGroup,
  getWagerWithPositions,
  getWagerSummary,
  calculatePayouts,
  type VerificationType,
} from "@/src/db/wager";
import {
  getVerificationMethodsDescription,
  validateVerificationConfig,
  isReadyForResolution,
} from "@/src/lib/wager";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound wager tools
 * Only available in group chats
 */
export function createWagerTools(context: ConversationContext) {
  // Wager tools are only available in group chats
  if (!context.isGroup) {
    return {};
  }

  const conversationId = context.conversationId;
  const senderPhone = context.sender;

  return {
    /**
     * Tool for proposing a new wager/market
     */
    proposeWager: tool({
      description:
        "Create a NEW wager/betting market for the group. " +
        "Use this when someone wants to bet on an outcome. " +
        "The creator doesn't have to take a position - they can just create the market. " +
        "Choose the appropriate verification type based on the bet:\n" +
        getVerificationMethodsDescription(),
      inputSchema: zodSchema(
        z.object({
          title: z
            .string()
            .describe(
              "Short, catchy title for the wager (e.g., 'Pizza Arrival', 'Game Winner')",
            ),
          condition: z
            .string()
            .describe(
              "Clear description of what's being bet on (e.g., 'Pizza arrives before 7:45 PM')",
            ),
          sides: z
            .array(z.string())
            .length(2)
            .optional()
            .default(["YES", "NO"])
            .describe(
              "The two sides of the bet. Defaults to ['YES', 'NO']. " +
                "Can be custom like ['UNDER', 'OVER'] or ['TEAM_A', 'TEAM_B']",
            ),
          verificationType: z
            .enum(["subjective", "deadline", "photo_proof"])
            .describe(
              "How the wager will be verified. " +
                "Choose based on the nature of the bet.",
            ),
          deadline: z
            .iso
            .datetime()
            .optional()
            .describe(
              "ISO datetime for when the event happens or betting closes. " +
                "Required for deadline verification, optional for others.",
            ),
          creatorSide: z
            .string()
            .optional()
            .describe(
              "If the creator wants to take a position, which side they're on. " +
                "Leave empty if creator is just creating the market without betting.",
            ),
          creatorAmount: z
            .number()
            .positive()
            .optional()
            .describe(
              "If the creator is taking a position, how much they're betting. " +
                "Required if creatorSide is specified.",
            ),
        }),
      ),
      execute: async ({
        title,
        condition,
        sides,
        verificationType,
        deadline,
        creatorSide,
        creatorAmount,
      }) => {
        try {
          if (!senderPhone) {
            return {
              success: false,
              message: "Could not identify who is proposing the wager.",
            };
          }

          // Validate verification config
          const verificationConfig = deadline ? { deadline } : undefined;
          const configValidation = validateVerificationConfig(
            verificationType as VerificationType,
            verificationConfig,
          );

          if (!configValidation.valid) {
            return {
              success: false,
              message: configValidation.error || "Invalid verification config",
            };
          }

          // Validate creator position if specified
          if (creatorSide && !sides.includes(creatorSide)) {
            return {
              success: false,
              message: `Invalid side: ${creatorSide}. Must be one of: ${sides.join(", ")}`,
            };
          }

          if (creatorSide && !creatorAmount) {
            return {
              success: false,
              message: "Must specify amount if taking a position",
            };
          }

          // Create the wager
          const wager = await createWager({
            conversationId,
            creatorPhone: senderPhone,
            title,
            condition,
            sides,
            verificationType: verificationType as VerificationType,
            verificationConfig: configValidation.config,
            deadline: deadline ? new Date(deadline) : undefined,
          });

          // Place creator's position if they're betting
          if (creatorSide && creatorAmount) {
            await placePosition({
              wagerId: wager.id,
              phone: senderPhone,
              side: creatorSide,
              amount: creatorAmount,
            });
          }

          // Get updated wager with positions
          const updated = await getWagerWithPositions(wager.id);

          return {
            success: true,
            message:
              `New wager created: "${title}" ` +
              (creatorSide
                ? `with ${senderPhone} on ${creatorSide} for $${creatorAmount}`
                : "(creator not betting)"),
            wager: {
              id: wager.id,
              title,
              condition,
              sides,
              verificationType,
              deadline,
              status: updated?.status || "open",
            },
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to create wager: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      },
    }),

    /**
     * Tool for taking a position on a wager
     */
    takePosition: tool({
      description:
        "Take a position (place a bet) on an existing wager. " +
        "Multiple people can be on the same side. " +
        "Bets are matched against the opposite side - if there's no one on the other side yet, " +
        "the position is unmatched until someone takes the other side.",
      inputSchema: zodSchema(
        z.object({
          wagerId: z.string().describe("The ID of the wager to bet on"),
          side: z
            .string()
            .describe("Which side to take (e.g., 'YES', 'NO', 'UNDER', 'OVER')"),
          amount: z.number().positive().describe("How much to bet (in dollars)"),
        }),
      ),
      execute: async ({ wagerId, side, amount }) => {
        try {
          if (!senderPhone) {
            return {
              success: false,
              message: "Could not identify who is placing the bet.",
            };
          }

          const { position, wager } = await placePosition({
            wagerId,
            phone: senderPhone,
            side,
            amount,
          });

          const summary = getWagerSummary(wager);
          const matched = position.matchedAmount;
          const unmatched = amount - matched;

          let statusMessage = `${senderPhone} bet $${amount} on ${side}. `;
          if (matched > 0 && unmatched > 0) {
            statusMessage += `$${matched} matched, $${unmatched} waiting for takers.`;
          } else if (matched > 0) {
            statusMessage += `Fully matched!`;
          } else {
            statusMessage += `Waiting for someone to take the other side.`;
          }

          return {
            success: true,
            message: statusMessage,
            wager: {
              id: wager.id,
              title: wager.title,
              status: wager.status,
              totalPool: summary.totalPool,
              matchedPool: summary.matchedPool,
            },
            position: {
              side,
              amount,
              matched,
              unmatched,
            },
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to place bet: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      },
    }),

    /**
     * Tool for listing active wagers in the group
     */
    listWagers: tool({
      description:
        "List all active wagers in this group chat. " +
        "Shows open and active wagers with their current positions.",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        try {
          const wagers = await getActiveWagersForGroup(conversationId);

          if (wagers.length === 0) {
            return {
              success: true,
              message: "No active wagers in this group.",
              wagers: [],
            };
          }

          const wagerSummaries = wagers.map((w) => {
            const summary = getWagerSummary(w);
            return {
              id: w.id,
              title: w.title,
              condition: w.condition,
              sides: w.sides,
              status: w.status,
              deadline: w.deadline?.toISOString(),
              verificationType: w.verificationType,
              totalPool: summary.totalPool,
              matchedPool: summary.matchedPool,
              sideTotals: summary.sideTotals,
            };
          });

          return {
            success: true,
            message: `Found ${wagers.length} active wager(s).`,
            wagers: wagerSummaries,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to list wagers: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      },
    }),

    /**
     * Tool for resolving a wager
     */
    resolveWager: tool({
      description:
        "Resolve a wager by declaring the winning side. " +
        "Use this when the outcome is determined. " +
        "For photo_proof wagers, include the proof URL. " +
        "Calculates and announces payouts.",
      inputSchema: zodSchema(
        z.object({
          wagerId: z.string().describe("The ID of the wager to resolve"),
          winningSide: z.string().describe("The winning side of the bet"),
          proofUrl: z
            .url()
            .optional()
            .describe("URL to photo proof (for photo_proof verification type)"),
        }),
      ),
      execute: async ({ wagerId, winningSide, proofUrl }) => {
        try {
          // Get the wager to check verification status
          const wager = await getWagerWithPositions(wagerId);
          if (!wager) {
            return {
              success: false,
              message: "Wager not found.",
            };
          }

          // Check if ready for resolution
          const readyCheck = isReadyForResolution(
            wager.verificationType,
            wager.verificationConfig,
          );

          // For deadline wagers, check if we should allow early resolution
          if (
            wager.verificationType === "deadline" &&
            !readyCheck.ready &&
            !proofUrl
          ) {
            return {
              success: false,
              message: `Cannot resolve yet: ${readyCheck.reason}. ` +
                `Provide photo proof for early resolution.`,
            };
          }

          // Resolve the wager
          const resolved = await resolveWager(wagerId, winningSide, proofUrl);

          // Calculate payouts
          const payouts = calculatePayouts(resolved);

          const payoutMessages = payouts
            .map((p) => `${p.phone}: $${p.amount.toFixed(2)}`)
            .join(", ");

          return {
            success: true,
            message:
              `Wager "${resolved.title}" resolved! ` +
              `Winner: ${winningSide}. ` +
              (payouts.length > 0
                ? `Payouts: ${payoutMessages}`
                : "No payouts (no matched bets)."),
            wager: {
              id: resolved.id,
              title: resolved.title,
              result: resolved.result,
              status: resolved.status,
            },
            payouts,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to resolve wager: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      },
    }),

    /**
     * Tool for cancelling an unmatched wager
     */
    cancelWager: tool({
      description:
        "Cancel a wager that hasn't been matched yet. " +
        "Only works if no positions have been matched. " +
        "All unmatched bets are returned.",
      inputSchema: zodSchema(
        z.object({
          wagerId: z.string().describe("The ID of the wager to cancel"),
        }),
      ),
      execute: async ({ wagerId }) => {
        try {
          // Verify the requester is the creator or check other authorization
          const wager = await getWagerWithPositions(wagerId);
          if (!wager) {
            return {
              success: false,
              message: "Wager not found.",
            };
          }

          // Only creator can cancel (or could expand to any participant)
          if (wager.creatorPhone !== senderPhone) {
            return {
              success: false,
              message: "Only the wager creator can cancel it.",
            };
          }

          const cancelled = await cancelWager(wagerId);

          return {
            success: true,
            message: `Wager "${cancelled.title}" has been cancelled. All bets returned.`,
            wager: {
              id: cancelled.id,
              title: cancelled.title,
              status: cancelled.status,
            },
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to cancel wager: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      },
    }),

    /**
     * Tool for getting details on a specific wager
     */
    getWagerDetails: tool({
      description:
        "Get detailed information about a specific wager, including all positions and payouts.",
      inputSchema: zodSchema(
        z.object({
          wagerId: z.string().describe("The ID of the wager"),
        }),
      ),
      execute: async ({ wagerId }) => {
        try {
          const wager = await getWagerWithPositions(wagerId);
          if (!wager) {
            return {
              success: false,
              message: "Wager not found.",
            };
          }

          const summary = getWagerSummary(wager);
          const payouts =
            wager.status === "resolved" ? calculatePayouts(wager) : null;

          return {
            success: true,
            wager: {
              id: wager.id,
              title: wager.title,
              condition: wager.condition,
              sides: wager.sides,
              status: wager.status,
              deadline: wager.deadline?.toISOString(),
              verificationType: wager.verificationType,
              result: wager.result,
              resolvedAt: wager.resolvedAt?.toISOString(),
              proofUrl: wager.proofUrl,
              creatorPhone: wager.creatorPhone,
              createdAt: wager.createdAt.toISOString(),
            },
            summary: {
              totalPool: summary.totalPool,
              matchedPool: summary.matchedPool,
              sideTotals: summary.sideTotals,
            },
            positions: wager.positions.map((p) => ({
              phone: p.phone,
              side: p.side,
              amount: p.amount,
              matched: p.matchedAmount,
              unmatched: p.amount - p.matchedAmount,
            })),
            payouts,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to get wager details: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      },
    }),
  };
}
