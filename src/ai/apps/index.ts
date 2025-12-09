/**
 * AI Apps System
 *
 * Apps are self-contained modules with their own agent, state, and behavior.
 */

export { negotiationApp } from "./negotiation";
export {
  appExists,
  getAllAppIds,
  getAllApps,
  getApp,
  getAppForContext,
} from "./registry";
export type { AppDefinition } from "./types";
