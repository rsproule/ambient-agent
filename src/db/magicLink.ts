/**
 * Magic Link Token Management
 *
 * Uses NextAuth's VerificationToken model for magic link authentication
 */

import prisma from "@/src/db/client";
import { upsertUser } from "@/src/db/user";

export interface MagicLinkToken {
  token: string;
  expiresAt: Date;
  userId: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  user?: {
    id: string;
    phoneNumber?: string;
    name?: string;
    email?: string;
    image?: string;
  };
  error?: string;
}

/**
 * Generate a cryptographically secure random token
 * Uses Web Crypto API (compatible with Edge runtime)
 */
function generateToken(): string {
  // Generate 32 random bytes using Web Crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to hex string (universally compatible)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a magic link token for a user (identified by phone number)
 * Token expires in 1 hour
 *
 * @param phoneNumber User's phone number
 * @returns Token string and expiration date
 */
export async function createMagicLinkToken(
  phoneNumber: string,
): Promise<MagicLinkToken> {
  // Ensure user exists (create if not)
  const { user } = await upsertUser(phoneNumber);

  // Generate token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Store in VerificationToken table
  // identifier is the userId, token is the magic link token
  await prisma.verificationToken.create({
    data: {
      identifier: user.id,
      token,
      expires: expiresAt,
    },
  });

  return {
    token,
    expiresAt,
    userId: user.id,
  };
}

/**
 * Validate a magic link token
 * Checks if token exists, hasn't expired, and returns the associated user
 * Token can be used multiple times until it expires (1 hour)
 *
 * @param token Magic link token to validate
 * @returns Validation result with user data if valid
 */
export async function validateMagicLinkToken(
  token: string,
): Promise<ValidateTokenResult> {
  try {
    console.log(`[MagicLink] Validating token: ${token.substring(0, 8)}...`);

    // Find the token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      console.log(`[MagicLink] Token not found`);
      return {
        valid: false,
        error: "Invalid token",
      };
    }

    // Check if expired
    if (verificationToken.expires < new Date()) {
      console.log(
        `[MagicLink] Token expired at ${verificationToken.expires.toISOString()}`,
      );
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: { token },
      });

      return {
        valid: false,
        error: "Token expired",
      };
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: verificationToken.identifier },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        email: true,
        image: true,
      },
    });

    if (!user) {
      console.log(
        `[MagicLink] User not found for identifier: ${verificationToken.identifier}`,
      );
      return {
        valid: false,
        error: "User not found",
      };
    }

    // Token remains valid until expiration (multi-use)
    console.log(`[MagicLink] Token valid, user: ${user.id}`);
    return {
      valid: true,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber ?? undefined,
        name: user.name ?? undefined,
        email: user.email ?? undefined,
        image: user.image ?? undefined,
      },
    };
  } catch (error) {
    console.error("[MagicLink] Error validating token:", error);
    return {
      valid: false,
      error: "Validation error",
    };
  }
}

/**
 * Clean up expired tokens (can be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.verificationToken.deleteMany({
    where: {
      expires: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Generate a full magic link URL for a phone number
 * This URL can be sent to the user via iMessage
 *
 * @param phoneNumber User's phone number
 * @param baseUrl Application base URL (e.g., http://localhost:3000)
 * @returns Full magic link URL
 */
export async function generateMagicLinkUrl(
  phoneNumber: string,
  baseUrl: string,
): Promise<string> {
  const { token } = await createMagicLinkToken(phoneNumber);

  // The magic link goes to NextAuth's callback endpoint
  return `${baseUrl}/api/auth/callback/credentials?token=${token}`;
}
