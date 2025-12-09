/**
 * AI Apps System
 *
 * Apps are self-contained modules with their own agent, state, and behavior.
 */

export type { AppDefinition } from "./types";
export {
  appExists,
  getAllAppIds,
  getAllApps,
  getApp,
  getAppForContext,
} from "./registry";
export { negotiationApp } from "./negotiation";
