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
export type MessageEffect = (typeof MESSAGE_EFFECTS)[number];

/**
 * Message reaction type
 */
export type MessageReaction = (typeof MESSAGE_REACTIONS)[number];

/**
 * Service type
 */
export type ServiceType = (typeof SERVICES)[number];

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  BASE_URL: "https://server.loopmessage.com/api/v1",
  SEND_MESSAGE: "/message/send/",
  MESSAGE_STATUS: "/message/status/",
} as const;

/**
 * Message delivery statuses from the status API
 * https://docs.loopmessage.com/imessage-conversation-api/statuses
 */
export const MESSAGE_STATUSES = [
  "processing",
  "scheduled",
  "failed",
  "sent",
  "timeout",
  "unknown",
] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/**
 * Send Message API error codes
 * https://docs.loopmessage.com/imessage-conversation-api/sending-messages
 */
export const SEND_MESSAGE_ERROR_CODES: Record<number, string> = {
  100: "Bad request",
  110: "Missing credentials in request",
  120: "One or more required parameters for the request are missing",
  125: "Authorization key is invalid or does not exist",
  130: "Secret key is invalid or does not exist",
  140: "No 'text' parameter in request",
  150: "No 'recipient' parameter in request",
  160: "Invalid recipient",
  170: "Invalid recipient email",
  180: "Invalid recipient phone number",
  190: "A phone number is not mobile",
  210: "Sender name not specified in request parameters",
  220: "Invalid sender name",
  230: "An internal error occurred while trying to use the specified sender name",
  240: "Sender name is not activated or unpaid",
  270: "This recipient blocked any type of messages",
  300: "Unable to send this type of message without dedicated sender name",
  330: "Sending too frequently to recipients you haven't contacted for a long time",
  400: "No available requests/credits on your balance",
  500: "Your account is suspended",
  510: "Your account is blocked",
  530: "Your account is suspended due to debt",
  540: "No active purchased sender name to send message",
  545: "Your sender name has been suspended by Apple",
  550: "Requires a dedicated sender name or need to add this recipient as sandbox contact",
  560: "Unable to send outbound messages until this recipient initiates a conversation",
  570: "This API request is deprecated and not supported",
  580: "Invalid effect parameter",
  590: "Invalid message_id for reply",
  595: "Invalid or non-existent message_id",
  600: "Invalid reaction parameter",
  610: "Reaction or message_id is invalid or does not exist",
  620: "Unable to use effect and reaction parameters in the same request",
  630: "Need to set up a vCard file for this sender name in the dashboard",
  640: "No media file URL - media_url",
  1110: "Unable to send SMS if the recipient is an email address",
  1120: "Unable to send SMS if the recipient is group",
  1130: "Unable to send SMS with marketing content",
  1140: "Unable to send audio messages through SMS",
};
