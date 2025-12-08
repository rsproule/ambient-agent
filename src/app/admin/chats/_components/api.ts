// API functions for admin chats

import type { ConversationDetail, ConversationListItem } from "./types";

export async function fetchConversations(): Promise<ConversationListItem[]> {
  const res = await fetch("/api/admin/conversations");
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    if (res.status === 403)
      throw new Error("Forbidden - Admin access required");
    throw new Error("Failed to fetch conversations");
  }
  const data = await res.json();
  return data.conversations || [];
}

export async function fetchConversation(
  id: string,
): Promise<ConversationDetail> {
  const res = await fetch(`/api/admin/conversations/${id}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    if (res.status === 403)
      throw new Error("Forbidden - Admin access required");
    throw new Error("Failed to fetch conversation");
  }
  return res.json();
}

export async function deleteMessage(messageId: string): Promise<void> {
  const res = await fetch(`/api/admin/messages/${messageId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete message");
  }
}

export async function sendMessage({
  text,
  recipient,
  group,
}: {
  text: string;
  recipient?: string;
  group?: string;
}): Promise<{ success: boolean; taskId: string; conversationId: string }> {
  const response = await fetch("/api/admin/send-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient, group, text }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to send message");
  }
  return response.json();
}

export async function retryMessage(
  messageId: string,
): Promise<{ success: boolean; taskId: string; messageId: string }> {
  const response = await fetch(`/api/admin/messages/${messageId}/retry`, {
    method: "POST",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to retry message");
  }
  return response.json();
}

export interface LoopMessageStatus {
  message_id: string;
  status:
    | "processing"
    | "scheduled"
    | "failed"
    | "sent"
    | "timeout"
    | "unknown";
  recipient: string;
  text: string;
  sandbox?: boolean;
  error_code?: number;
  sender_name?: string;
  passthrough?: string;
  last_update?: string;
}

export interface CheckMessageStatusResponse {
  success: boolean;
  localMessageId: string;
  loopMessageId: string;
  status: LoopMessageStatus;
}

export async function checkMessageStatus(
  messageId: string,
): Promise<CheckMessageStatusResponse> {
  const response = await fetch(`/api/admin/messages/${messageId}/status`);
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to check message status");
  }
  return response.json();
}
