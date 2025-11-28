/**
 * API endpoint for initiating OAuth connection
 * POST /api/connections/{provider}/connect
 */

import { NextRequest, NextResponse } from "next/server";
import { pipedreamClient } from "@/src/lib/pipedream/client";
import { getProviderConfig } from "@/src/lib/pipedream/providers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      return NextResponse.json(
        { error: "Invalid provider" },
        { status: 400 }
      );
    }

    // Generate the callback URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/connections/${provider}/callback?userId=${userId}`;

    // Create a Pipedream Connect token
    const connectResponse = await pipedreamClient.createConnectToken({
      app: providerConfig.app,
      scopes: providerConfig.scopes,
      redirectUri,
    });

    return NextResponse.json({
      connectUrl: connectResponse.connect_link,
      token: connectResponse.token,
    });
  } catch (error) {
    console.error("Error creating connection:", error);
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }
}

