import type { Agent } from "@/src/ai/agents/types";
import type { ConversationContext } from "@/src/db/conversation";
import type { Tool } from "ai";

/**
 * App Definition
 *
 * Apps are self-contained modules with their own agent, state, and behavior.
 * Launched by the kernel (orchestrator) based on context.
 */
export interface AppDefinition {
  /** Unique identifier for the app */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this app does */
  description: string;

  /**
   * The agent to use when this app is active.
   * If undefined, uses the default agent (mrWhiskers).
   */
  agent?: Agent;

  /**
   * Whitelist of tool names available in this app.
   * If undefined, all tools are available.
   */
  allowedTools?: string[];

  /** Additional tools specific to this app */
  additionalTools?: Record<string, Tool>;

  /** System prompt injected when this app is active */
  systemPrompt: string;

  /**
   * Determines if this app should auto-activate based on context.
   * Called by the kernel to decide which app to launch.
   */
  shouldActivate?: (context: ConversationContext) => boolean;

  /** Called when app is activated */
  onActivate?: (context: ConversationContext) => Promise<void>;

  /** Called when app is deactivated */
  onDeactivate?: (context: ConversationContext) => Promise<void>;

  /** Optional custom context builder */
  buildAppContext?: (context: ConversationContext) => string;
}
