/**
 * Message Queue Type Definitions
 *
 * Defines the structure for generic messages that can be queued
 * and processed by the message processing system.
 */

// Target discriminated union types
export type UserTarget = {
  type: "user_id";
  userId: string;
};

export type PhoneTarget = {
  type: "phone_number";
  phoneNumber: string;
};

export type GlobalTarget = {
  type: "global";
};

export type SegmentTarget = {
  type: "segment";
  segmentId: string;
};

export type MessageTarget =
  | UserTarget
  | PhoneTarget
  | GlobalTarget
  | SegmentTarget;

// Bribe/Payment payload (optional)
export interface BribePayload {
  amount?: number;
  currency?: string;
  transactionId?: string;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
}

// Generic message payload (can be any JSON structure)
export type MessagePayload = Record<string, unknown>;

// Message status enum
export enum MessageStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Complete message structure matching the database schema
export interface QueuedMessage {
  id: string;
  target: MessageTarget;
  source: string;
  bribePayload?: BribePayload;
  payload: MessagePayload;
  status: MessageStatus;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}

// Input type for creating a new queued message (without generated fields)
export interface CreateQueuedMessageInput {
  target: MessageTarget;
  source: string;
  bribePayload?: BribePayload;
  payload: MessagePayload;
}

// Type guards for target discrimination
export function isUserTarget(target: MessageTarget): target is UserTarget {
  return target.type === "user_id";
}

export function isPhoneTarget(target: MessageTarget): target is PhoneTarget {
  return target.type === "phone_number";
}

export function isGlobalTarget(target: MessageTarget): target is GlobalTarget {
  return target.type === "global";
}

export function isSegmentTarget(
  target: MessageTarget,
): target is SegmentTarget {
  return target.type === "segment";
}
