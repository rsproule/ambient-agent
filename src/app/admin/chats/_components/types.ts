// Shared types for admin chats

export type ViewMode = "chat" | "events";

export interface ConversationListItem {
  id: string;
  conversationId: string;
  isGroup: boolean;
  groupName: string | null;
  participants: string[];
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: unknown;
  sender: string | null;
  messageId: string | null;
  attachments: string[];
  forwarded: boolean | null;
  rejectionReason: string | null;
  deliveryStatus:
    | "pending"
    | "scheduled"
    | "sent"
    | "failed"
    | "timeout"
    | null;
  deliveryError: string | null;
  createdAt: string;
}

export interface UserContextDocument {
  id: string;
  title: string;
  source: string;
  content: string;
  createdAt: string;
}

export interface UserContext {
  summary: string | null;
  facts: unknown[] | null;
  interests: string[];
  professional: Record<string, unknown> | null;
  timezone: string | null;
  documents: UserContextDocument[];
}

export interface ConversationInfo {
  id: string;
  conversationId: string;
  isGroup: boolean;
  groupName: string | null;
  participants: string[];
  summary: string | null;
  currentApp: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: ConversationInfo;
  messages: Message[];
  userContext: UserContext | null;
}

export interface Event {
  id: string;
  conversationId: string | null;
  userId: string | null;
  type: string;
  source: string;
  payload: unknown;
  createdAt: string;
}
