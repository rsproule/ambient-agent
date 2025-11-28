/**
 * OAuth callback endpoint
 * GET /api/connections/{provider}/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { pipedreamClient } from "@/src/lib/pipedream/client";
import { getProviderConfig } from "@/src/lib/pipedream/providers";
import { upsertConnection } from "@/src/db/connection";
import type { ConnectionProvider } from "@/src/generated/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const accountId = searchParams.get("account_id"); // Pipedream returns this
    const error = searchParams.get("error");

    if (error) {
      // Redirect back to connections page with error
      return NextResponse.redirect(
        new URL(`/connections/${userId}?error=${error}`, request.url)
      );
    }

    if (!userId || !accountId) {
      return NextResponse.redirect(
        new URL(`/connections/${userId}?error=missing_params`, request.url)
      );
    }

    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      return NextResponse.redirect(
        new URL(`/connections/${userId}?error=invalid_provider`, request.url)
      );
    }

    // Fetch account details from Pipedream
    const account = await pipedreamClient.getAccount(accountId);

    // Store the connection in the database
    await upsertConnection({
      userId,
      provider: provider as ConnectionProvider,
      pipedreamAccountId: account.id,
      accountEmail: account.name,
      accountId: account.id,
      accessToken: account.auth_provision?.oauth_access_token,
      refreshToken: account.auth_provision?.oauth_refresh_token,
      expiresAt: account.auth_provision?.expires_at
        ? new Date(account.auth_provision.expires_at * 1000)
        : undefined,
      scopes: providerConfig.scopes,
      metadata: {
        healthy: account.healthy,
      },
    });

    // Redirect back to connections page with success
    return NextResponse.redirect(
      new URL(`/connections/${userId}?success=${provider}`, request.url)
    );
  } catch (error) {
    console.error("Error handling OAuth callback:", error);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    return NextResponse.redirect(
      new URL(`/connections/${userId}?error=callback_failed`, request.url)
    );
  }
}

