/**
 * LoopMessage API Constants - From official API documentation
 * Based on: https://docs.loopmessage.com/imessage-conversation-api/sending-messages
 */

/**
 * Message effects for iMessage - exact from API docs
 */
export const MESSAGE_EFFECTS = [
  "slam",
  "loud",
  "gentle",
  "invisibleInk",
  "echo",
  "spotlight",
  "balloons",
  "confetti",
  "love",
  "lasers",
  "fireworks",
  "shootingStar",
  "celebration",
] as const;

/**
 * Message reactions for iMessage - exact from API docs
 * Includes remove variants (prefixed with -)
 */
export const MESSAGE_REACTIONS = [
  "love",
  "like",
  "dislike",
  "laugh",
  "exclaim",
  "question",
  "-love",
  "-like",
  "-dislike",
  "-laugh",
  "-exclaim",
  "-question",
] as const;

/**
 * Service types - from API docs
 */
export const SERVICES = ["imessage", "sms"] as const;

/**
 * Message effect type
 */
export type MessageEffect = typeof MESSAGE_EFFECTS[number];

/**
 * Message reaction type
 */
export type MessageReaction = typeof MESSAGE_REACTIONS[number];

/**
 * Service type
 */
export type ServiceType = typeof SERVICES[number];

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  BASE_URL: "https://server.loopmessage.com/api/v1",
  SEND_MESSAGE: "/message/send/",
} as const;