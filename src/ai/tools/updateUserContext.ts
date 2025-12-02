import type { ConversationContext } from "@/src/db/conversation";
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
 * Create context-bound updateUserContext tool
 *
 * Allows the agent to store information about a user including:
 * - Timezone preference
 * - Professional info (company, role, projects)
 * - Interests and topics they care about
 * - Outbound messaging permission
 *
 * Can also trigger background research for important facts.
 *
 * Security: Phone number is taken from authenticated context, not user input.
 */
export function createUpdateUserContextTool(context: ConversationContext) {
  // Get the authenticated phone number from context (system-provided, cannot be spoofed)
  const authenticatedPhone = context.isGroup
    ? context.sender
    : context.conversationId;

  return tool({
    description:
      "Update or store your context information. " +
      "Use this to save information you share about yourself, including your timezone. " +
      "Can record outbound messaging permission (outboundOptIn). " +
      "For important facts (job changes, new interests), set storeAsFact=true " +
      "to store it in the research system with semantic search.",
    inputSchema: zodSchema(
      z.object({
        timezone: z
          .string()
          .optional()
          .describe(
            "Your timezone in IANA format (e.g. 'America/New_York', 'Europe/London', 'Asia/Tokyo'). " +
              "Set this when you share your timezone or location.",
          ),
        interests: z
          .array(z.string())
          .optional()
          .describe(
            "Interests or topics you care about. These will be appended to existing interests.",
          ),
        professional: z
          .object({
            company: z.string().optional(),
            role: z.string().optional(),
            projects: z.array(z.string()).optional(),
          })
          .passthrough()
          .optional()
          .describe("Professional info (company, role, projects, etc.)"),
        outboundOptIn: z
          .boolean()
          .optional()
          .describe(
            "Set to true if you agree to receive proactive messages (reminders, alerts, updates). " +
              "Set to false to decline. Only set this when you explicitly answer.",
          ),
        storeAsFact: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "If true, also stores this as a searchable fact in the research system. " +
              "Use for important info like job changes, new interests, etc.",
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
      timezone,
      interests,
      professional,
      outboundOptIn,
      storeAsFact,
      factContent,
      invalidatesTopics,
    }) => {
      try {
        if (!authenticatedPhone) {
          return {
            success: false,
            message: "Could not identify user. Please try again.",
          };
        }

        // Get user to find their ID
        const user = await getUserByPhoneNumber(authenticatedPhone);
        if (!user) {
          return {
            success: false,
            message: "User not found. You may need to set up your account first.",
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
          await setOutboundOptIn(authenticatedPhone, outboundOptIn);
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

        const messageParts = ["Your context updated successfully."];
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
}
