/**
 * Proactive Notification Hooks
 *
 * Each hook checks a specific data source for noteworthy information
 * and returns whether to notify the user.
 */

export { checkCalendar } from "./checkCalendar";
export { checkGitHub } from "./checkGitHub";
export { checkGmail } from "./checkGmail";
export { checkTwitter } from "./checkTwitter";
export { checkConnectionReminder } from "./checkConnectionReminder";
export { checkScheduledJobs } from "./checkScheduledJobs";
export { checkDeepResearch } from "./checkDeepResearch";

