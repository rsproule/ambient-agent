/**
 * Pipedream API Client
 *
 * Handles OAuth connections and API interactions with Pipedream
 */

import { createClient } from "@pipedream/sdk";
import { env } from "@/src/lib/config/env";
import type {
  ConnectedAccount,
  ConnectTokenResponse,
} from "@pipedream/sdk/dist/connect";

export interface PipedreamAppConfig {
  app: string;
  scopes: string[];
  redirectUri: string;
}

export class PipedreamClient {
  private client: ReturnType<typeof createClient>;

  constructor(apiKey?: string) {
    this.client = createClient({
      projectId: env.TRIGGER_PROJECT_ID || "imessage-pipeline",
      credentials: {
        keys: { secret: apiKey || env.PIPEDREAM_API_KEY || "" },
      },
    });
  }

  /**
   * Generate a Pipedream Connect link for OAuth flow
   */
  async createConnectToken(
    config: PipedreamAppConfig,
  ): Promise<ConnectTokenResponse> {
    const response = await this.client.createConnectToken({
      app: config.app,
      external_id: crypto.randomUUID(),
      ...(env.PIPEDREAM_OAUTH_APP_ID && {
        oauth_app_id: env.PIPEDREAM_OAUTH_APP_ID,
      }),
    });

    return response;
  }

  /**
   * Get connected account details
   */
  async getAccount(accountId: string): Promise<ConnectedAccount> {
    const response = await this.client.getConnectedAccount(accountId);
    return response;
  }

  /**
   * Delete a connected account
   */
  async deleteAccount(accountId: string): Promise<void> {
    await this.client.deleteConnectedAccount(accountId);
  }

  /**
   * Refresh OAuth tokens for an account
   */
  async refreshToken(accountId: string): Promise<ConnectedAccount> {
    const response = await this.client.refreshConnectedAccountToken(accountId);
    return response;
  }

  /**
   * List all connected accounts
   */
  async listAccounts(): Promise<ConnectedAccount[]> {
    const response = await this.client.listConnectedAccounts();
    return response.data || [];
  }
}

export const pipedreamClient = new PipedreamClient();

