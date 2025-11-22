import type { Result } from "@/lib/result";

/**
 * Strict types for task handlers
 */

export type MessageTarget =
  | { type: "individual"; recipient: string }
  | { type: "group"; groupId: string };

export type EchoSuccess = {
  target: MessageTarget;
  messageText: string;
  response: unknown;
};

export type RespondSuccess = {
  target: MessageTarget;
  messageText: string;
  response: unknown;
};

export type SkipReason = 
  | "not_inbound_message"
  | "no_message_text"
  | "no_sender_or_group"
  | "decided_not_to_respond"
  | string;

export type TaskResult = 
  | { action: "echoed"; data: EchoSuccess }
  | { action: "responded"; data: RespondSuccess }
  | { action: "skipped"; reason: SkipReason };

export type TaskError = {
  code: string;
  message: string;
};

export type HandleMessageResult = Result<TaskResult, TaskError>;

