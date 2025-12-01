/**
 * OAuth callback endpoint
 * GET /api/connections/{provider}/callback
 */

import { upsertConnection } from "@/src/db/connection";
import type { ConnectionProvider } from "@/src/generated/prisma";
import { listUserAccounts } from "@/src/lib/pipedream/client";
import { getProviderConfig } from "@/src/lib/pipedream/providers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const error = searchParams.get("error");

    if (error) {
      // Redirect back to connections page with error
      return NextResponse.redirect(
        new URL(`/connections/${userId}?error=${error}`, request.url),
      );
    }

    if (!userId) {
      return NextResponse.redirect(
        new URL(`/connections?error=missing_user_id`, request.url),
      );
    }

    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      return NextResponse.redirect(
        new URL(`/connections/${userId}?error=invalid_provider`, request.url),
      );
    }

    // Pipedream Connect doesn't pass account_id in the redirect
    // Instead, we list accounts for this user and find the most recent one for this app
    // Note: There may be a timing issue where Pipedream hasn't finished creating the account yet
    console.log(
      `[Callback] Fetching accounts for user ${userId}, app: ${providerConfig.app}`,
    );

    // Retry logic to handle timing issues with Pipedream account creation
    let account = null;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries && !account; attempt++) {
      if (attempt > 0) {
        console.log(
          `[Callback] Retry attempt ${attempt}/${
            maxRetries - 1
          } after ${retryDelay}ms delay`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }

      // List ALL accounts for the user (SDK's app filter doesn't seem to work reliably)
      // We'll filter by app name ourselves with case-insensitive comparison
      const allAccounts = await listUserAccounts(userId, {
        includeCredentials: true,
      });

      console.log(
        `[Callback] Attempt ${attempt + 1}: Found ${
          allAccounts.length
        } total accounts for user ${userId}`,
      );

      if (allAccounts.length > 0) {
        allAccounts.forEach((acc, idx) => {
          console.log(`[Callback] Account ${idx}:`, {
            id: acc.id,
            name: acc.name,
            externalId: acc.externalId,
            appId: acc.app?.id,
            appName: acc.app?.name,
            appNameSlug: acc.app?.nameSlug,
            healthy: acc.healthy,
            createdAt: acc.createdAt,
          });
        });
      }

      // Filter accounts for this specific app
      const accounts = allAccounts.filter((acc) => {
        // Normalize: lowercase and replace spaces with underscores for comparison
        const normalize = (str?: string) =>
          str?.toLowerCase().replace(/\s+/g, "_");

        const appName = normalize(acc.app?.name);
        const appNameSlug = normalize(acc.app?.nameSlug);
        const appId = normalize(acc.app?.id);
        const targetApp = normalize(providerConfig.app);

        const appMatch =
          appNameSlug === targetApp ||
          appName === targetApp ||
          appId === targetApp;

        return appMatch;
      });

      console.log(
        `[Callback] Found ${accounts.length} matching accounts after filtering`,
      );

      // Find the most recently created account for this provider
      if (accounts.length > 0) {
        account = accounts.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })[0];
      }
    }

    if (!account) {
      console.error(
        `[Callback] No account found after ${maxRetries} attempts for user ${userId} and app ${providerConfig.app}`,
      );
      return NextResponse.redirect(
        new URL(`/connections/${userId}?error=no_account_found`, request.url),
      );
    }

    console.log(`[Callback] Using account:`, {
      id: account.id,
      name: account.name,
      healthy: account.healthy,
    });

    // Extract OAuth credentials from the credentials object
    const credentials = account.credentials as
      | Record<string, unknown>
      | undefined;
    const oauthAccessToken = credentials?.oauth_access_token as
      | string
      | undefined;
    const oauthRefreshToken = credentials?.oauth_refresh_token as
      | string
      | undefined;

    // Store the connection in the database
    await upsertConnection({
      userId,
      provider: provider as ConnectionProvider,
      pipedreamAccountId: account.id,
      accountEmail: account.name,
      accountId: account.id,
      accessToken: oauthAccessToken,
      refreshToken: oauthRefreshToken,
      expiresAt: account.expiresAt,
      scopes: providerConfig.scopes,
      metadata: {
        healthy: account.healthy,
        dead: account.dead,
        error: account.error,
      },
    });

    // Redirect back to connections page with success
    return NextResponse.redirect(
      new URL(`/connections/${userId}?success=${provider}`, request.url),
    );
  } catch (error) {
    console.error("Error handling OAuth callback:", error);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    return NextResponse.redirect(
      new URL(`/connections/${userId}?error=callback_failed`, request.url),
    );
  }
}
