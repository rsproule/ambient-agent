import { getUserByPhoneNumber, setOnboardingComplete } from "@/src/db/user";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Tool for completing user onboarding
 *
 * Use this when the user has:
 * - Understood your capabilities
 * - Connected at least one account OR explicitly declined
 * - Shared some basic info about themselves
 * - Been asked about proactive messaging
 */
export const completeOnboardingTool = tool({
  description:
    "Mark a user as having completed onboarding. " +
    "Use this when you feel the user understands what you can do, has been offered to connect accounts, " +
    "and you've gathered basic info about them (or they've declined to share). " +
    "Once onboarding is complete, the onboarding prompts will no longer be shown. " +
    "Don't rush this - make sure the user is actually set up before calling.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format)"),
      reason: z
        .string()
        .optional()
        .describe(
          "Brief note about why onboarding is complete (e.g., 'connected gmail and calendar', 'declined connections but understands capabilities')",
        ),
    }),
  ),
  execute: async ({ phoneNumber, reason }) => {
    try {
      // Get user to verify they exist
      const user = await getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          success: false,
          message: `User not found for phone number: ${phoneNumber}`,
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
      await setOnboardingComplete(phoneNumber, true);

      console.log(
        `[Onboarding] Completed for ${phoneNumber}${reason ? `: ${reason}` : ""}`,
      );

      return {
        success: true,
        message: `Onboarding completed for user. ${reason ? `Reason: ${reason}` : ""}`,
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


