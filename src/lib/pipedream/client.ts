/**
 * Pipedream API Client
 *
 * Direct export of the official Pipedream SDK client
 * Documentation: https://github.com/PipedreamHQ/pipedream-sdk-typescript
 */

import { pipedreamConfig } from "@/src/lib/config/env";
import * as Pipedream from "@pipedream/sdk";

// Initialize the Pipedream SDK client
const clientId = pipedreamConfig.clientId;
const clientSecret = pipedreamConfig.clientSecret;
const projectId = pipedreamConfig.projectId;
const projectEnvironment = pipedreamConfig.projectEnvironment || "production";

if (!clientId || !clientSecret || !projectId) {
  console.warn(
    "⚠️ Pipedream credentials not configured. Set PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, and PIPEDREAM_PROJECT_ID",
  );
}

// Validate project environment - must be "development" or "production"
const validEnvironment = (
  projectEnvironment === "development" ? "development" : "production"
) as "development" | "production";

// Export configured Pipedream client
export const pipedream = new Pipedream.PipedreamClient({
  clientId: clientId || "",
  clientSecret: clientSecret || "",
  projectId: projectId || "",
  projectEnvironment: validEnvironment,
});

/**
 * Helper methods for common Pipedream operations with proper typing
 */

/**
 * Create a Connect token for a user with optional configuration
 */
export async function createConnectToken(
  externalUserId: string,
  options?: {
    successRedirectUri?: string;
    errorRedirectUri?: string;
    allowedOrigins?: string[];
  },
): Promise<Pipedream.CreateTokenResponse> {
  return pipedream.tokens.create({
    externalUserId,
    successRedirectUri: options?.successRedirectUri,
    errorRedirectUri: options?.errorRedirectUri,
    allowedOrigins: options?.allowedOrigins,
  });
}

/**
 * Get account details by ID
 */
export async function getAccount(
  accountId: string,
  includeCredentials = true,
): Promise<Pipedream.Account> {
  return pipedream.accounts.retrieve(accountId, {
    includeCredentials,
  });
}

/**
 * Delete an account by ID
 */
export async function deleteAccount(accountId: string): Promise<void> {
  return pipedream.accounts.delete(accountId);
}

/**
 * List all accounts for a user
 */
export async function listUserAccounts(
  externalUserId: string,
  options?: {
    app?: string;
    includeCredentials?: boolean;
  },
): Promise<Pipedream.Account[]> {
  const accounts: Pipedream.Account[] = [];
  const page = await pipedream.accounts.list({
    externalUserId,
    app: options?.app,
    includeCredentials: options?.includeCredentials ?? false,
  });

  for await (const account of page) {
    accounts.push(account);
  }

  return accounts;
}

/**
 * Get refreshed credentials for an account
 * Re-fetches the account to get the latest credentials
 */
export async function getRefreshedAccount(
  accountId: string,
): Promise<Pipedream.Account> {
  return getAccount(accountId, true);
}
