import type { ConversationContext } from "@/src/db/conversation";
import { getUserByPhoneNumber, setOnboardingComplete } from "@/src/db/user";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound completeOnboarding tool
 *
 * Use this when the user has:
 * - Understood your capabilities
 * - Connected at least one account OR explicitly declined
 * - Shared some basic info about themselves
 * - Been asked about proactive messaging
 *
 * Security: Phone number is taken from authenticated context, not user input.
 */
export function createCompleteOnboardingTool(context: ConversationContext) {
  // Get the authenticated phone number from context (system-provided, cannot be spoofed)
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Mark the current user as having completed onboarding. " +
      "Use this when you feel the user understands what you can do, has been offered to connect accounts, " +
      "and you've gathered basic info about them (or they've declined to share). " +
      "Once onboarding is complete, the onboarding prompts will no longer be shown. " +
      "Don't rush this - make sure the user is actually set up before calling.",
    inputSchema: zodSchema(
      z.object({
        reason: z
          .string()
          .optional()
          .describe(
            "Brief note about why onboarding is complete (e.g., 'connected gmail and calendar', 'declined connections but understands capabilities')",
          ),
      }),
    ),
    execute: async ({ reason }) => {
      try {
        if (!authenticatedPhone) {
          return {
            success: false,
            message: "Could not identify user. Please try again.",
          };
        }

        // Get user to verify they exist
        const user = await getUserByPhoneNumber(authenticatedPhone);
        if (!user) {
          return {
            success: false,
            message:
              "User not found. You may need to set up your account first.",
          };
        }

        // Check if already onboarded
        if (user.hasCompletedOnboarding) {
          return {
            success: true,
            message: "User has already completed onboarding.",
            alreadyCompleted: true,
          };
        }

        // Mark onboarding complete
        await setOnboardingComplete(authenticatedPhone, true);

        console.log(
          `[Onboarding] Completed for ${authenticatedPhone}${reason ? `: ${reason}` : ""}`,
        );

        return {
          success: true,
          message: `Onboarding completed. ${reason ? `Reason: ${reason}` : ""}`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to complete onboarding: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}

