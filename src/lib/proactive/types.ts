/**
 * Types for the proactive notification system
 */

/**
 * Hook names for tracking
 */
export type HookName =
  | "calendar"
  | "github"
  | "gmail"
  | "connectionReminder"
  | "scheduledJobs"
  | "deepResearch";

/**
 * Result from a proactive hook check
 */
export interface HookResult {
  shouldNotify: boolean;
  message?: string;
  /** Content signature for deduplication (e.g., "calendar:event-id-123") */
  contentSignature?: string;
  /** Additional metadata for logging/debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed to each hook
 */
export interface HookContext {
  userId: string;
  phoneNumber: string;
  timezone: string;
  /** Recent messages in conversation (for deduplication) */
  recentMessages: Array<{
    role: string;
    content: string;
    createdAt: Date;
  }>;
  /** User's connected accounts */
  connections: {
    gmail: boolean;
    github: boolean;
    calendar: boolean;
  };
}

/**
 * A proactive hook function
 */
export type ProactiveHook = (context: HookContext) => Promise<HookResult>;

/**
 * Per-hook schedule configuration
 * Defines how often each hook should run (in minutes)
 */
export interface HookScheduleConfig {
  /** Check calendar every N minutes (default: 15 - important for meeting reminders) */
  calendar: number;
  /** Check GitHub every N minutes (default: 60 - PRs aren't that urgent) */
  github: number;
  /** Check Gmail every N minutes (default: 120 - don't spam about emails) */
  gmail: number;
  /** Check for connection reminder every N minutes (default: 10080 = 7 days) */
  connectionReminder: number;
  /** Check scheduled jobs every N minutes (default: 15 - matches cron) */
  scheduledJobs: number;
  /** Run deep research every N minutes (default: 480 = 8 hours) */
  deepResearch: number;
}

/**
 * Default schedules for each hook (in minutes)
 */
export const DEFAULT_HOOK_SCHEDULES: HookScheduleConfig = {
  calendar: 15, // Every 15 min - need to catch upcoming meetings
  github: 60, // Every hour - PR reviews can wait a bit
  gmail: 120, // Every 2 hours - don't spam about emails
  connectionReminder: 10080, // Once a week (7 * 24 * 60)
  scheduledJobs: 15, // Every 15 min - matches the cron frequency
  deepResearch: 480, // Every 8 hours - keeps user context fresh
};

/**
 * Additional config for specific hooks
 */
export interface HookConfig {
  /** Minutes before a meeting to send reminder (default: 30) */
  calendarReminderMinutes: number;
}

export const DEFAULT_HOOK_CONFIG: HookConfig = {
  calendarReminderMinutes: 30,
};

