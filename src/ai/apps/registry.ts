import type { ConversationContext } from "@/src/db/conversation";
import { negotiationApp } from "./negotiation";
import type { AppDefinition } from "./types";

const apps: AppDefinition[] = [negotiationApp];

const appRegistry = new Map<string, AppDefinition>(
  apps.map((app) => [app.id, app]),
);

export function getApp(appId: string): AppDefinition | undefined {
  return appRegistry.get(appId);
}

export function appExists(appId: string): boolean {
  return appRegistry.has(appId);
}

export function getAllAppIds(): string[] {
  return Array.from(appRegistry.keys());
}

export function getAllApps(): AppDefinition[] {
  return apps;
}

/**
 * Determine which app should be active based on context.
 * Returns the app that should auto-activate, or undefined for default behavior.
 */
export function getAppForContext(
  context: ConversationContext,
): AppDefinition | undefined {
  // Check if there's an explicitly set app
  if (context.currentApp) {
    return getApp(context.currentApp);
  }

  // Check if any app wants to auto-activate
  for (const app of apps) {
    if (app.shouldActivate?.(context)) {
      return app;
    }
  }

  return undefined;
}
