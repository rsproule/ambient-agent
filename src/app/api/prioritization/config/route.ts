import { NextRequest, NextResponse } from "next/server";
import {
  getPrioritizationConfig,
  upsertPrioritizationConfig,
  deletePrioritizationConfig,
} from "@/src/db/prioritization";
import { DEFAULT_CONFIG } from "@/src/services/prioritization";
import { z } from "zod";

/**
 * Schema for creating/updating prioritization config
 */
const PrioritizationConfigSchema = z.object({
  conversationId: z
    .string()
    .min(1, "conversationId is required")
    .describe("Phone number or group_id"),
  minimumNotifyPrice: z
    .number()
    .min(-1000)
    .max(10000)
    .describe("Dollar threshold for delivery"),
  customValuePrompt: z
    .string()
    .optional()
    .describe("Custom AI prompt for value evaluation"),
  isEnabled: z
    .boolean()
    .optional()
    .default(true)
    .describe("Enable/disable prioritization"),
});

/**
 * GET /api/prioritization/config?conversationId=xxx
 * Get prioritization config for a conversation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId query parameter is required" },
        { status: 400 },
      );
    }

    const config = await getPrioritizationConfig(conversationId);

    // If no config exists, return defaults
    if (!config) {
      return NextResponse.json({
        success: true,
        config: {
          conversationId,
          ...DEFAULT_CONFIG,
        },
        isDefault: true,
        message: "No custom config set, using default values",
      });
    }

    return NextResponse.json({
      success: true,
      config,
      isDefault: false,
    });
  } catch (error) {
    console.error("Error getting prioritization config:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/prioritization/config
 * Create or update prioritization config for a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = PrioritizationConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const { conversationId, ...configData } = validation.data;

    // Upsert the config
    const config = await upsertPrioritizationConfig(
      conversationId,
      configData,
    );

    return NextResponse.json({
      success: true,
      config,
      message: "Prioritization config saved successfully",
    });
  } catch (error) {
    console.error("Error upserting prioritization config:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/prioritization/config?conversationId=xxx
 * Delete prioritization config for a conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId query parameter is required" },
        { status: 400 },
      );
    }

    await deletePrioritizationConfig(conversationId);

    return NextResponse.json({
      success: true,
      message: `Prioritization config deleted for conversation: ${conversationId}`,
    });
  } catch (error) {
    console.error("Error deleting prioritization config:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

