/**
 * API endpoint for initiating OAuth connection
 * POST /api/connections/{provider}/connect
 */

import { pipedreamConfig } from "@/src/lib/config/env";
import { createConnectToken } from "@/src/lib/pipedream/client";
import { getProviderConfig } from "@/src/lib/pipedream/providers";
import { NextRequest, NextResponse } from "next/server";

// Force Node.js runtime for Pipedream SDK and Prisma compatibility
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    // Generate the callback URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const callbackUrl = `${baseUrl}/api/connections/${provider}/callback`;
    const successRedirectUri = `${callbackUrl}?userId=${userId}`;
    const errorRedirectUri = `${baseUrl}/connections/${userId}?error=auth_failed`;

    // Create a Pipedream Connect token using the SDK
    console.log(
      `[Connect] Creating token for user ${userId}, provider: ${provider}`,
    );
    console.log(`[Connect] Success redirect: ${successRedirectUri}`);
    console.log(`[Connect] Error redirect: ${errorRedirectUri}`);

    const connectResponse = await createConnectToken(userId, {
      successRedirectUri,
      errorRedirectUri,
      allowedOrigins: baseUrl ? [baseUrl] : undefined,
    });

    console.log(`[Connect] Token created:`, {
      token: connectResponse.token.substring(0, 20) + "...",
      expiresAt: connectResponse.expiresAt,
      connectLinkUrl: connectResponse.connectLinkUrl,
    });

    // Build the connect URL with the app parameter
    // This tells Pipedream Connect which OAuth app to connect
    const connectUrl = new URL(connectResponse.connectLinkUrl);
    connectUrl.searchParams.set("app", providerConfig.app);

    // If we have an oauthAppId configured, use it
    if (pipedreamConfig.oauthAppId) {
      console.log(
        `[Connect] Using OAuth app ID: ${pipedreamConfig.oauthAppId}`,
      );
      connectUrl.searchParams.set("oauthAppId", pipedreamConfig.oauthAppId);
    } else {
      console.warn(
        `[Connect] No OAuth app ID configured - using Pipedream default OAuth client`,
      );
    }

    console.log(`[Connect] Final connect URL: ${connectUrl.toString()}`);

    return NextResponse.json({
      connectUrl: connectUrl.toString(),
      token: connectResponse.token,
    });
  } catch (error) {
    console.error("Error creating connection:", error);
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 },
    );
  }
}
