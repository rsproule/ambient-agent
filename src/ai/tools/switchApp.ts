import { appExists, getAllAppIds, getApp } from "@/src/ai/apps";
import prisma from "@/src/db/client";
import type { ConversationContext } from "@/src/db/conversation";
import { logAppExit, logAppLaunch } from "@/src/db/events";
import logger from "@/src/lib/logger";
import { tool, zodSchema } from "ai";
import { z } from "zod";

/**
 * Create context-bound switchApp tool
 *
 * Allows Whiskers to switch between apps.
 * Each app has its own agent, tools, and behavior.
 *
 * Use "default" to exit any app and return to normal operation.
 */
export function createSwitchAppTool(context: ConversationContext) {
  const log = logger.child({
    component: "switchApp",
    conversationId: context.conversationId,
  });

  return tool({
    description:
      "Switch to a different app. Each app has its own behavior and tools. " +
      `Available apps: ${getAllAppIds().join(", ")}. ` +
      "Use 'default' to exit any app and return to normal operation.",
    inputSchema: zodSchema(
      z.object({
        appId: z
          .string()
          .describe(
            "The app ID to switch to (e.g., 'negotiation'), or 'default' to exit",
          ),
        reason: z
          .string()
          .describe("Brief explanation of why you're switching apps"),
      }),
    ),
    execute: async ({ appId, reason }) => {
      try {
        const normalizedAppId = appId.toLowerCase().trim();

        // Handle "default" to exit app
        if (normalizedAppId === "default") {
          const previousApp = context.currentApp;
          await updateConversationApp(context.conversationId, null);

          log.info("Exited app", { reason });

          // Log app exit event
          if (previousApp) {
            await logAppExit(context.conversationId, previousApp, reason);
          }

          return {
            success: true,
            message: "Switched to default (full tool access).",
            previousApp: previousApp || null,
            currentApp: null,
          };
        }

        // Validate app exists
        if (!appExists(normalizedAppId)) {
          const availableApps = getAllAppIds();
          return {
            success: false,
            message: `App '${appId}' not found. Available apps: ${availableApps.join(", ")}, or 'default'.`,
          };
        }

        // Get app details for response
        const app = getApp(normalizedAppId);
        const previousApp = context.currentApp;

        // Update conversation app
        await updateConversationApp(context.conversationId, normalizedAppId);

        log.info("Switched app", {
          from: previousApp || "default",
          to: normalizedAppId,
          reason,
        });

        // Log app exit if there was a previous app
        if (previousApp) {
          await logAppExit(context.conversationId, previousApp, reason);
        }

        // Log app launch
        await logAppLaunch(context.conversationId, normalizedAppId, reason);

        return {
          success: true,
          message: `Switched to ${app?.name || normalizedAppId}.`,
          previousApp: previousApp || null,
          currentApp: normalizedAppId,
          appDescription: app?.description,
        };
      } catch (error) {
        log.error("Failed to switch app", { error, appId });
        return {
          success: false,
          message: `Failed to switch app: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });
}

/**
 * Update the current app for a conversation
 */
async function updateConversationApp(
  conversationId: string,
  appId: string | null,
): Promise<void> {
  await prisma.conversation.update({
    where: { conversationId },
    data: { currentApp: appId },
  });
}
