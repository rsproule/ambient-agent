import prisma from "@/src/db/client";
import type { ConversationContext } from "@/src/db/conversation";
import { getUserByPhoneNumber } from "@/src/db/user";
import { getTreasuryBalance, transferUsdc } from "@/src/lib/blockchain/usdc";
import { env } from "@/src/lib/config/env";
import { tool, zodSchema } from "ai";
import type { Address } from "viem";
import { z } from "zod";

/**
 * Create context-bound getBankroll tool
 *
 * Returns the current treasury balance (available funds for payouts)
 */
export function createGetBankrollTool() {
  return tool({
    description:
      "Get the current bankroll (treasury balance) available for negotiation payouts. " +
      "Call this before negotiating to know your limits.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      try {
        const balance = await getTreasuryBalance();

        if (!balance) {
          return {
            success: false,
            message: "Treasury wallet not configured",
          };
        }

        return {
          success: true,
          balance: balance.display,
          balanceFormatted: balance.formatted,
          balanceRaw: balance.raw.toString(),
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to get bankroll: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}

/**
 * Create context-bound makeOffer tool
 *
 * Creates a formal offer in the database and returns it for user acceptance
 */
export function createMakeOfferTool(context: ConversationContext) {
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Make a formal USDC offer to the user during negotiation. " +
      "This creates a pending offer in the database. " +
      "Use this when you want to formally propose an amount. " +
      "The user must accept for the offer to be finalized.",
    inputSchema: zodSchema(
      z.object({
        amount: z
          .string()
          .describe(
            "The USDC amount to offer (e.g., '10.00' for $10.00). Must be a valid decimal number.",
          ),
        reason: z
          .string()
          .optional()
          .describe(
            "Brief explanation for the offer amount (e.g., 'based on your GitHub contributions')",
          ),
      }),
    ),
    execute: async ({ amount, reason }) => {
      try {
        if (!authenticatedPhone) {
          return {
            success: false,
            message: "Could not identify user. Please try again.",
          };
        }

        // Validate amount format
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          return {
            success: false,
            message: "Invalid amount. Please provide a positive number.",
          };
        }

        // Get user
        const user = await getUserByPhoneNumber(authenticatedPhone);
        if (!user) {
          return {
            success: false,
            message: "User not found. Please try again.",
          };
        }

        // Check if user already has a payout
        const existingPayout = await prisma.payout.findUnique({
          where: { userId: user.id },
        });

        if (existingPayout) {
          return {
            success: false,
            message:
              "This user has already received a payout and cannot receive another.",
            existingPayoutAmount: existingPayout.amount.toString(),
          };
        }

        // Check treasury balance
        const balance = await getTreasuryBalance();
        if (!balance || parseFloat(balance.formatted) < parsedAmount) {
          return {
            success: false,
            message: `Insufficient treasury balance. Available: ${
              balance?.display || "$0.00"
            }`,
          };
        }

        // Expire any existing pending offers for this user
        await prisma.negotiationOffer.updateMany({
          where: {
            userId: user.id,
            status: "pending",
          },
          data: {
            status: "expired",
          },
        });

        // Create the new offer
        const offer = await prisma.negotiationOffer.create({
          data: {
            conversationId: context.conversationId,
            userId: user.id,
            amount: parsedAmount,
            status: "pending",
          },
        });

        console.log(
          `[Negotiation] Offer created: $${amount} for ${authenticatedPhone}${
            reason ? ` - ${reason}` : ""
          }`,
        );

        return {
          success: true,
          offerId: offer.id,
          amount: amount,
          message: `Offer of $${amount} USDC created. Waiting for user acceptance.`,
          reason,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create offer: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}

/**
 * Create context-bound finalizeNegotiation tool
 *
 * Accepts the current offer, triggers payout, and returns balance page link
 */
export function createFinalizeNegotiationTool(context: ConversationContext) {
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Finalize the negotiation after the user accepts your offer. " +
      "This will execute the USDC transfer to the user's wallet. " +
      "Only call this when the user has clearly accepted the offer.",
    inputSchema: zodSchema(
      z.object({
        offerId: z
          .string()
          .optional()
          .describe(
            "The offer ID to finalize. If not provided, will use the most recent pending offer.",
          ),
      }),
    ),
    execute: async ({ offerId }) => {
      try {
        if (!authenticatedPhone) {
          return {
            success: false,
            message: "Could not identify user. Please try again.",
          };
        }

        // Get user
        const user = await getUserByPhoneNumber(authenticatedPhone);
        if (!user) {
          return {
            success: false,
            message: "User not found. Please try again.",
          };
        }

        // Check if user already has a payout
        const existingPayout = await prisma.payout.findUnique({
          where: { userId: user.id },
        });

        if (existingPayout) {
          return {
            success: false,
            message:
              "This user has already received a payout and cannot receive another.",
            existingPayoutAmount: existingPayout.amount.toString(),
          };
        }

        // Find the offer to finalize
        let offer;
        if (offerId) {
          offer = await prisma.negotiationOffer.findUnique({
            where: { id: offerId },
          });
        } else {
          // Get most recent pending offer for this user
          offer = await prisma.negotiationOffer.findFirst({
            where: {
              userId: user.id,
              status: "pending",
            },
            orderBy: { createdAt: "desc" },
          });
        }

        if (!offer) {
          return {
            success: false,
            message: "No pending offer found. Please make an offer first.",
          };
        }

        if (offer.status !== "pending") {
          return {
            success: false,
            message: `Offer is not pending (status: ${offer.status}). Cannot finalize.`,
          };
        }

        // Get or create Privy user and wallet
        let walletAddress = user.walletAddress;

        if (!walletAddress) {
          // Call our endpoint to create/get Privy user
          const baseUrl = env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
          const response = await fetch(`${baseUrl}/api/users/create-by-phone`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber: authenticatedPhone }),
          });

          if (!response.ok) {
            const error = await response.json();
            return {
              success: false,
              message: `Failed to create wallet: ${
                error.error || "Unknown error"
              }`,
            };
          }

          const privyUser = await response.json();
          walletAddress = privyUser.walletAddress;

          if (!walletAddress) {
            return {
              success: false,
              message:
                "Could not create wallet for user. Please try again later.",
            };
          }

          // Store wallet address on user
          await prisma.user.update({
            where: { id: user.id },
            data: { walletAddress },
          });
        }

        // Create pending payout record
        const payout = await prisma.payout.create({
          data: {
            userId: user.id,
            offerId: offer.id,
            amount: offer.amount,
            walletAddress,
            status: "pending",
          },
        });

        // Execute the USDC transfer
        const transferResult = await transferUsdc(
          walletAddress as Address,
          offer.amount.toString(),
        );

        if (!transferResult.success) {
          // Mark payout as failed
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: "failed",
              error: transferResult.error,
            },
          });

          // Keep offer as pending so they can retry
          return {
            success: false,
            message: `Transfer failed: ${transferResult.error}`,
          };
        }

        // Mark offer as accepted
        await prisma.negotiationOffer.update({
          where: { id: offer.id },
          data: { status: "accepted" },
        });

        // Mark payout as completed
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: "completed",
            txHash: transferResult.txHash,
            completedAt: new Date(),
          },
        });

        // Update NegotiationApp status if it exists
        await prisma.negotiationApp.updateMany({
          where: { conversationId: context.conversationId },
          data: { status: "completed" },
        });

        const baseUrl = env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const balancePageUrl = `${baseUrl}/balance`;

        console.log(
          `[Negotiation] Payout completed: $${offer.amount} to ${authenticatedPhone} (${walletAddress})`,
        );

        return {
          success: true,
          amount: offer.amount.toString(),
          walletAddress,
          txHash: transferResult.txHash,
          balancePageUrl,
          message: `Successfully sent $${offer.amount} USDC! Check your balance at: ${balancePageUrl}`,
        };
      } catch (error) {
        console.error(JSON.stringify(error, null, 2));
        return {
          success: false,
          message: `Failed to finalize negotiation: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}

/**
 * Create all negotiation tools for a context
 */
export function createNegotiationTools(context: ConversationContext) {
  return {
    getBankroll: createGetBankrollTool(),
    makeOffer: createMakeOfferTool(context),
    finalizeNegotiation: createFinalizeNegotiationTool(context),
  };
}
