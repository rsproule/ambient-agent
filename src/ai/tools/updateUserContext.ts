import { getUserByPhoneNumber, setOutboundOptIn } from "@/src/db/user";
import {
  appendInterests,
  getOrCreateUserContext,
  updateUserContext as updateUserContextDb,
} from "@/src/db/userContext";
import { queueConversationResearchJob } from "@/src/lib/research/createJob";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Tool for updating user context
 *
 * Allows the agent to store information about a user including:
 * - Timezone preference
 * - Professional info (company, role, projects)
 * - Interests and topics they care about
 * - Outbound messaging permission
 *
 * Can also trigger background research for important facts.
 */
export const updateUserContextTool = tool({
  description:
    "Update or store context for a specific user by their phone number. " +
    "Use this to save information the user shares about themselves, including their timezone. " +
    "Can record outbound messaging permission (outboundOptIn). " +
    "For important facts about the user (job changes, new interests), set storeAsFact=true " +
    "to store it in the research system with semantic search.",
  inputSchema: zodSchema(
    z.object({
      phoneNumber: z
        .string()
        .describe("The user's phone number (E.164 format or email)"),
      timezone: z
        .string()
        .optional()
        .describe(
          "User's timezone in IANA format (e.g. 'America/New_York', 'Europe/London', 'Asia/Tokyo'). " +
            "Set this when the user tells you their timezone or location.",
        ),
      interests: z
        .array(z.string())
        .optional()
        .describe(
          "Interests or topics the user cares about. These will be appended to existing interests.",
        ),
      professional: z
        .object({
          company: z.string().optional(),
          role: z.string().optional(),
          projects: z.array(z.string()).optional(),
        })
        .passthrough()
        .optional()
        .describe(
          "Professional info about the user (company, role, projects, etc.)",
        ),
      outboundOptIn: z
        .boolean()
        .optional()
        .describe(
          "Set to true if user agrees to receive proactive messages (reminders, alerts, updates). " +
            "Set to false if they decline. Only set this when user explicitly answers.",
        ),
      storeAsFact: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "If true, also stores this as a searchable fact in the research system. " +
            "Use for important user info like job changes, new interests, etc.",
        ),
      factContent: z
        .string()
        .optional()
        .describe(
          "If storeAsFact is true, this is the fact text to store. " +
            "Example: 'User works at OpenAI as a researcher'",
        ),
      invalidatesTopics: z
        .array(z.string())
        .optional()
        .describe(
          "Topics that this new information invalidates. " +
            "Example: ['previous employment', 'Google job'] if user changed jobs.",
        ),
    }),
  ),
  execute: async ({
    phoneNumber,
    timezone,
    interests,
    professional,
    outboundOptIn,
    storeAsFact,
    factContent,
    invalidatesTopics,
  }) => {
    try {
      // Get user to find their ID
      const user = await getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          success: false,
          message: `User not found for phone number: ${phoneNumber}`,
        };
      }

      // Update user context in the new system
      const updates: {
        timezone?: string;
        interests?: string[];
        professional?: Record<string, unknown>;
      } = {};

      if (timezone) {
        updates.timezone = timezone;
      }

      if (interests && interests.length > 0) {
        await appendInterests(user.id, interests);
      }

      if (professional) {
        const existingContext = await getOrCreateUserContext(user.id);
        updates.professional = {
          ...(existingContext.professional || {}),
          ...professional,
        };
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await updateUserContextDb(user.id, updates);
      }

      // Update outbound opt-in if provided
      if (outboundOptIn !== undefined) {
        await setOutboundOptIn(phoneNumber, outboundOptIn);
      }

      // Optionally store as a research fact
      let researchJobId: string | undefined;
      if (storeAsFact && factContent) {
        const { jobId } = await queueConversationResearchJob({
          userId: user.id,
          content: factContent,
          invalidates: invalidatesTopics,
        });
        researchJobId = jobId;
      }

      const messageParts = [
        `User context updated successfully for ${phoneNumber}.`,
      ];
      if (timezone) {
        messageParts.push(`Timezone set to ${timezone}.`);
      }
      if (interests && interests.length > 0) {
        messageParts.push(`Added ${interests.length} interests.`);
      }
      if (professional) {
        messageParts.push(`Updated professional info.`);
      }
      if (outboundOptIn !== undefined) {
        messageParts.push(
          `Outbound messaging: ${outboundOptIn ? "opted in" : "opted out"}.`,
        );
      }
      if (researchJobId) {
        messageParts.push(`Queued research job ${researchJobId}.`);
      }

      return {
        success: true,
        message: messageParts.join(" "),
        outboundOptIn,
        researchJobId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update user context: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});
