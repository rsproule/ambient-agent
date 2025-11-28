/**
 * API endpoint for requesting a magic link via phone number
 * POST /api/auth/request-link
 * 
 * This endpoint:
 * 1. Accepts a phone number
 * 2. Generates a magic link
 * 3. Sends it to the user via Mr. Whiskers (iMessage)
 */

import { NextRequest, NextResponse } from "next/server";

// Force Node.js runtime for Prisma and Trigger.dev compatibility
export const runtime = "nodejs";
import { generateMagicLinkUrl } from "@/src/db/magicLink";
import { env } from "@/src/lib/config/env";
import { tasks } from "@trigger.dev/sdk/v3";
import type { handleMessageResponse } from "@/src/trigger/tasks/handleMessage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Validate phone number format (basic validation)
    const cleanedPhone = phoneNumber.trim();
    if (cleanedPhone.length < 10) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Get the base URL
    const baseUrl =
      env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl.origin;

    // Generate the magic link
    const magicLinkUrl = await generateMagicLinkUrl(cleanedPhone, baseUrl);

    // Send the magic link via iMessage through Mr. Whiskers
    // We use the handleMessageResponse task to send the message
    const taskId = `magic-link-${Date.now()}`;
    
    await tasks.trigger<typeof handleMessageResponse>(
      "handle-message-response",
      {
        conversationId: cleanedPhone,
        recipient: cleanedPhone,
        actions: [
          {
            type: "message",
            text: `🔗 Here's your secure connection link!\n\nClick here to manage your accounts:\n${magicLinkUrl}\n\nThis link expires in 1 hour and can only be used once.`,
          },
        ],
        taskId,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Magic link sent! Check your messages.",
    });
  } catch (error) {
    console.error("Error requesting magic link:", error);
    return NextResponse.json(
      {
        error: "Failed to send magic link",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

