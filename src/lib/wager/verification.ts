/**
 * Wager Verification Abstraction
 *
 * Extensible registry pattern for verification methods.
 * The agent receives descriptions to auto-select the most appropriate type.
 */

import { z } from "zod";

// Must match Prisma enum
export type VerificationType = "subjective" | "deadline" | "photo_proof";

/**
 * Configuration schemas for each verification type
 */
export const verificationConfigSchemas = {
  subjective: z.object({}).optional(),
  deadline: z.object({
    deadline: z.string().datetime().describe("ISO datetime when the event should be resolved"),
  }),
  photo_proof: z.object({
    description: z.string().optional().describe("What the photo should show"),
  }).optional(),
} as const;

/**
 * Verification method definition for the registry
 */
export interface VerificationMethod {
  type: VerificationType;
  name: string;
  description: string;
  suggestedFor: string;
  requiresConfig: boolean;
  configSchema: z.ZodSchema;
}

/**
 * Registry of available verification methods
 * Agent uses this to understand when to use each type
 */
export const VERIFICATION_METHODS: VerificationMethod[] = [
  {
    type: "subjective",
    name: "Subjective (Group Vote)",
    description:
      "Winner declared by group consensus, honor system, or concession. " +
      "Anyone can call for resolution and the group decides.",
    suggestedFor:
      "Subjective outcomes, disputes, things requiring human judgment, " +
      "debates, predictions where proof is hard to obtain",
    requiresConfig: false,
    configSchema: verificationConfigSchemas.subjective,
  },
  {
    type: "deadline",
    name: "Deadline-Based",
    description:
      "Auto-prompts for resolution when deadline passes. " +
      "Good for time-sensitive bets where the outcome will be clear at a specific time.",
    suggestedFor:
      "Arrival times, 'will X happen by Y time', countdowns, " +
      "delivery bets, meeting deadlines, sports game outcomes",
    requiresConfig: true,
    configSchema: verificationConfigSchemas.deadline,
  },
  {
    type: "photo_proof",
    name: "Photo Proof",
    description:
      "Requires photo evidence to verify the outcome. " +
      "Winner provides timestamped photo or screenshot as proof.",
    suggestedFor:
      "Deliveries, physical achievements, 'prove it' scenarios, " +
      "completing challenges, showing receipts or results",
    requiresConfig: false,
    configSchema: verificationConfigSchemas.photo_proof,
  },
];

/**
 * Get a verification method by type
 */
export function getVerificationMethod(
  type: VerificationType,
): VerificationMethod | undefined {
  return VERIFICATION_METHODS.find((m) => m.type === type);
}

/**
 * Get all verification method descriptions for the agent
 * This is injected into tool descriptions so the agent can make informed choices
 */
export function getVerificationMethodsDescription(): string {
  return VERIFICATION_METHODS.map(
    (m) =>
      `- ${m.type}: ${m.description} Best for: ${m.suggestedFor}`,
  ).join("\n");
}

/**
 * Validate verification config for a given type
 */
export function validateVerificationConfig(
  type: VerificationType,
  config: unknown,
): { valid: boolean; error?: string; config?: unknown } {
  const method = getVerificationMethod(type);
  if (!method) {
    return { valid: false, error: `Unknown verification type: ${type}` };
  }

  if (!method.requiresConfig && !config) {
    return { valid: true, config: {} };
  }

  try {
    const parsed = method.configSchema.parse(config);
    return { valid: true, config: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: `Invalid config for ${type}: ${error.issues.map((e) => e.message).join(", ")}`,
      };
    }
    return { valid: false, error: "Invalid configuration" };
  }
}

/**
 * Check if a wager is ready for resolution based on its verification type
 */
export function isReadyForResolution(
  verificationType: VerificationType,
  verificationConfig: unknown,
  currentTime: Date = new Date(),
): { ready: boolean; reason?: string } {
  switch (verificationType) {
    case "subjective":
      // Subjective wagers can always be resolved by group consensus
      return { ready: true, reason: "Group can resolve at any time" };

    case "deadline": {
      const config = verificationConfig as { deadline?: string } | null;
      if (!config?.deadline) {
        return { ready: true, reason: "No deadline set" };
      }
      const deadline = new Date(config.deadline);
      if (currentTime >= deadline) {
        return { ready: true, reason: "Deadline has passed" };
      }
      return {
        ready: false,
        reason: `Deadline not reached (${deadline.toISOString()})`,
      };
    }

    case "photo_proof":
      // Photo proof wagers can be resolved once proof is provided
      return { ready: true, reason: "Awaiting photo proof" };

    default:
      return { ready: true };
  }
}
