/**
 * Wager Library
 *
 * Exports for the wagering system including verification abstraction.
 */

export {
  type VerificationType,
  type VerificationMethod,
  VERIFICATION_METHODS,
  getVerificationMethod,
  getVerificationMethodsDescription,
  validateVerificationConfig,
  isReadyForResolution,
  verificationConfigSchemas,
} from "./verification";
