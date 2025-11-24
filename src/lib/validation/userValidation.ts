/**
 * User validation utilities
 */

/**
 * Validate phone number format (E.164)
 * E.164: +[country code][number]
 * Examples: +14155552671, +442071838750
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Basic E.164 format: starts with +, followed by 7-15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  return e164Regex.test(phone);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.toLowerCase());
}

/**
 * Validate if a string is a valid user identifier (phone number or email)
 */
export function isValidUserIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== "string") {
    return false;
  }
  
  const trimmed = identifier.trim();
  
  // Check if it's a valid phone number or email
  return isValidPhoneNumber(trimmed) || isValidEmail(trimmed);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate a list of user identifiers (phone numbers or emails)
 * Returns the list of invalid identifiers, or empty array if all valid
 */
export function validateUserIdentifiers(
  identifiers: string[],
): { valid: boolean; invalid: string[] } {
  const invalid = identifiers.filter(
    (identifier) => !isValidUserIdentifier(identifier),
  );

  return {
    valid: invalid.length === 0,
    invalid,
  };
}

