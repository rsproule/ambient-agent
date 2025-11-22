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

export type SkipReason = 
  | "not_inbound_message"
  | "no_message_text"
  | "no_sender_or_group";

export type TaskResult = 
  | { action: "echoed"; data: EchoSuccess }
  | { action: "skipped"; reason: SkipReason };

export type TaskError = {
  code: string;
  message: string;
};

export type HandleMessageResult = Result<TaskResult, TaskError>;

