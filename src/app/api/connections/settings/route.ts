/**
 * Proactive Settings API
 *
 * Manage user's proactive notification settings (hook cooldowns, disabled hooks)
 */

import prisma from "@/src/db/client";
import type { Prisma } from "@/src/generated/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/connections/settings?userId=xxx
 *
 * Get user's proactive settings
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const userContext = await prisma.userContext.findUnique({
      where: { userId },
    });

    if (!userContext) {
      return NextResponse.json({
        hookCooldowns: null,
        disabledHooks: [],
      });
    }

    // Parse hookCooldowns JSON
    const hookCooldowns = userContext.hookCooldowns as Record<string, number> | null;

    // Disabled hooks are stored as cooldown = -1 or in a separate field
    // For simplicity, let's add a disabledHooks field or use cooldown = 0
    const disabledHooks: string[] = [];
    if (hookCooldowns) {
      for (const [hook, cooldown] of Object.entries(hookCooldowns)) {
        if (cooldown === 0 || cooldown === -1) {
          disabledHooks.push(hook);
        }
      }
    }

    return NextResponse.json({
      hookCooldowns,
      disabledHooks,
    });
  } catch (error) {
    console.error("[API] Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/connections/settings
 *
 * Update user's proactive settings
 *
 * Body:
 * {
 *   "userId": "xxx",
 *   "hookCooldowns": { "calendar": 15, "github": 60, ... },
 *   "disabledHooks": ["gmail", ...]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, hookCooldowns, disabledHooks } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // Merge disabled hooks into cooldowns (set to 0 for disabled)
    const finalCooldowns: Record<string, number> = { ...hookCooldowns };
    if (disabledHooks && Array.isArray(disabledHooks)) {
      for (const hook of disabledHooks) {
        finalCooldowns[hook] = 0; // 0 means disabled
      }
    }

    // Upsert user context with new settings
    await prisma.userContext.upsert({
      where: { userId },
      create: {
        userId,
        hookCooldowns: finalCooldowns as Prisma.InputJsonValue,
      },
      update: {
        hookCooldowns: finalCooldowns as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error saving settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 },
    );
  }
}

