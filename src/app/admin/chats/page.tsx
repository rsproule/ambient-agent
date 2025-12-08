"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Info,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Types
interface ConversationListItem {
  id: string;
  conversationId: string;
  isGroup: boolean;
  groupName: string | null;
  participants: string[];
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
}

interface Message {
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

interface UserContext {
  summary: string | null;
  facts: unknown[] | null;
  interests: string[];
  professional: Record<string, unknown> | null;
  timezone: string | null;
  documents: Array<{
    id: string;
    title: string;
    source: string;
    content: string;
    createdAt: string;
  }>;
}

interface ConversationDetail {
  conversation: {
    id: string;
    conversationId: string;
    isGroup: boolean;
    groupName: string | null;
    participants: string[];
    summary: string | null;
    lastMessageAt: string;
    createdAt: string;
  };
  messages: Message[];
  userContext: UserContext | null;
}

// API functions
async function fetchConversations(): Promise<ConversationListItem[]> {
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

async function fetchConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(`/api/admin/conversations/${id}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    if (res.status === 403)
      throw new Error("Forbidden - Admin access required");
    throw new Error("Failed to fetch conversation");
  }
  return res.json();
}

async function deleteMessage(messageId: string): Promise<void> {
  const res = await fetch(`/api/admin/messages/${messageId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete message");
  }
}

// Helper to extract text content from message
function getMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (typeof content === "object" && content !== null) {
    // Handle structured content (tool calls, actions, etc.)
    const obj = content as Record<string, unknown>;
    if ("actions" in obj && Array.isArray(obj.actions)) {
      // Extract text from actions
      return obj.actions
        .map((action: Record<string, unknown>) => {
          if (action.type === "message" && action.text) {
            return action.text as string;
          }
          return `[${action.type}]`;
        })
        .join(" | ");
    }
    return JSON.stringify(content, null, 2);
  }
  return String(content);
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Delivery status indicator component
function DeliveryStatusIcon({
  status,
  error,
}: {
  status: Message["deliveryStatus"];
  error: string | null;
}) {
  if (!status) return null;

  switch (status) {
    case "pending":
      return (
        <span title="Pending" className="text-muted-foreground">
          <Clock className="w-3 h-3" />
        </span>
      );
    case "scheduled":
      return (
        <span title="Scheduled" className="text-muted-foreground">
          <Check className="w-3 h-3" />
        </span>
      );
    case "sent":
      return (
        <span title="Delivered" className="text-primary">
          <CheckCheck className="w-3 h-3" />
        </span>
      );
    case "failed":
      return (
        <span title={error || "Delivery failed"} className="text-destructive">
          <AlertCircle className="w-3 h-3" />
        </span>
      );
    case "timeout":
      return (
        <span
          title={error || "Delivery timed out"}
          className="text-destructive"
        >
          <AlertCircle className="w-3 h-3" />
        </span>
      );
    default:
      return null;
  }
}

export default function AdminChatsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedConvoId = searchParams.get("chat");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update URL when selecting a conversation
  const setSelectedConvoId = (id: string | null) => {
    if (id) {
      router.push(`/admin/chats?chat=${id}`, { scroll: false });
    } else {
      router.push("/admin/chats", { scroll: false });
    }
  };

  // Fetch conversations list
  const {
    data: conversations = [],
    isLoading: loadingConversations,
    error: conversationsError,
  } = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: fetchConversations,
  });

  // Fetch selected conversation details (poll every 5 seconds)
  const {
    data: conversationDetail,
    isLoading: loadingDetail,
    error: detailError,
  } = useQuery({
    queryKey: ["admin-conversation", selectedConvoId],
    queryFn: () => fetchConversation(selectedConvoId!),
    enabled: !!selectedConvoId,
    refetchInterval: 5000,
  });

  // Scroll to bottom when messages load or change
  useEffect(() => {
    if (conversationDetail?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [conversationDetail?.messages]);

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      // Refetch conversation details after delete
      queryClient.invalidateQueries({
        queryKey: ["admin-conversation", selectedConvoId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-conversations"] });
    },
  });

  const handleDeleteMessage = (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMutation.mutate(messageId);
    }
  };

  // Send message mutation (simulate as Whiskers via Trigger.dev)
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      text,
      recipient,
      group,
    }: {
      text: string;
      recipient?: string;
      group?: string;
    }) => {
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
    },
    onSuccess: () => {
      setMessageInput("");
      // Refetch conversation details after send (with slight delay for task to complete)
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["admin-conversation", selectedConvoId],
        });
        queryClient.invalidateQueries({ queryKey: ["admin-conversations"] });
      }, 1000);
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !conversationDetail) return;

    const { conversation } = conversationDetail;
    sendMessageMutation.mutate({
      text: messageInput.trim(),
      // For groups, use group ID; for DMs, use conversationId (phone number)
      ...(conversation.isGroup
        ? { group: conversation.conversationId }
        : { recipient: conversation.conversationId }),
    });
  };

  // Error states
  if (conversationsError) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
            <p className="text-foreground">
              {conversationsError instanceof Error
                ? conversationsError.message
                : "Failed to load conversations"}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex justify-center overflow-hidden">
      <div className="w-full max-w-7xl flex border-x border-border h-full">
        {/* Sidebar - Conversation List */}
        <div className="w-80 bg-card border-r border-border flex flex-col shrink-0 h-full">
          <div className="p-4 border-b border-border">
            <h1 className="text-xl font-bold text-foreground">Admin: Chats</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {conversations.length} conversations
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No conversations yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => setSelectedConvoId(convo.id)}
                    className={`w-full p-3 text-left hover:bg-muted transition-colors ${
                      selectedConvoId === convo.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {convo.isGroup ? (
                        <Users className="w-4 h-4 mt-1 text-muted-foreground" />
                      ) : (
                        <User className="w-4 h-4 mt-1 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate text-sm">
                            {convo.isGroup
                              ? convo.groupName || "Group Chat"
                              : convo.conversationId}
                          </span>
                          {convo.isGroup && (
                            <Badge variant="secondary" className="text-xs">
                              Group
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <MessageSquare className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {convo.messageCount} messages
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ·
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(convo.lastMessageAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Chat View */}
        <div className="flex-1 flex flex-col bg-card h-full overflow-hidden">
          {!selectedConvoId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to view messages
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-3/4" />
              ))}
            </div>
          ) : detailError ? (
            <div className="flex-1 flex items-center justify-center text-destructive">
              Failed to load conversation
            </div>
          ) : conversationDetail ? (
            <>
              {/* Chat Header */}
              <div className="bg-card border-b border-border p-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">
                    {conversationDetail.conversation.isGroup
                      ? conversationDetail.conversation.groupName ||
                        "Group Chat"
                      : conversationDetail.conversation.conversationId}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {conversationDetail.messages.length} messages
                    {conversationDetail.conversation.isGroup &&
                      ` · ${conversationDetail.conversation.participants.length} participants`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSheetOpen(true)}
                >
                  <Info className="w-4 h-4 mr-2" />
                  View Context
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conversationDetail.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "assistant"
                        ? "justify-start"
                        : msg.role === "system"
                        ? "justify-center"
                        : "justify-end"
                    }`}
                  >
                    <div
                      onClick={() => setSelectedMessage(msg)}
                      className={`rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity ${
                        msg.role === "system"
                          ? "w-full bg-accent text-black border border-border"
                          : "max-w-[70%]"
                      } ${
                        msg.role === "assistant"
                          ? "bg-muted text-foreground"
                          : msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : ""
                      }`}
                    >
                      {/* Role badge or sender info */}
                      <div className="flex items-center gap-2 mb-1">
                        {msg.role === "user" && msg.sender ? (
                          <span className="text-xs font-medium text-primary-foreground/80">
                            {msg.sender}
                          </span>
                        ) : (
                          <Badge
                            variant={
                              msg.role === "assistant" ? "secondary" : "outline"
                            }
                            className="text-xs"
                          >
                            {msg.role}
                          </Badge>
                        )}
                      </div>

                      {/* Message content */}
                      <div className="whitespace-pre-wrap text-wrap text-sm">
                        {getMessageText(msg.content)}
                      </div>

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 text-xs opacity-75">
                          {msg.attachments.length} attachment(s)
                        </div>
                      )}

                      {/* Timestamp, delivery status, and actions */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs ${
                              msg.role === "assistant"
                                ? "text-muted-foreground"
                                : msg.role === "system"
                                ? "text-black/60"
                                : "text-primary-foreground/70"
                            }`}
                          >
                            {formatDate(msg.createdAt)}
                          </span>
                          {msg.role === "assistant" && (
                            <DeliveryStatusIcon
                              status={msg.deliveryStatus}
                              error={msg.deliveryError}
                            />
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={deleteMutation.isPending}
                          className={`ml-2 p-1 rounded hover:bg-foreground/10 transition-colors ${
                            msg.role === "user"
                              ? "text-primary-foreground/70 hover:text-primary-foreground"
                              : "text-muted-foreground hover:text-destructive"
                          }`}
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Send message input */}
              <div className="p-4 border-t border-border bg-card">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Send as Mr. Whiskers..."
                    disabled={sendMessageMutation.isPending}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={
                      !messageInput.trim() || sendMessageMutation.isPending
                    }
                    size="icon"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
                {sendMessageMutation.isError && (
                  <p className="text-destructive text-xs mt-2">
                    {sendMessageMutation.error?.message || "Failed to send"}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Context Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Conversation Context</SheetTitle>
              <SheetDescription>
                Context information injected into the AI system prompt
              </SheetDescription>
            </SheetHeader>

            {conversationDetail && (
              <div className="mt-6 space-y-6">
                {/* Conversation Info */}
                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    Conversation
                  </h3>
                  <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID:</span>{" "}
                      <span className="font-mono text-xs">
                        {conversationDetail.conversation.conversationId}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      {conversationDetail.conversation.isGroup
                        ? "Group Chat"
                        : "Direct Message"}
                    </div>
                    {conversationDetail.conversation.groupName && (
                      <div>
                        <span className="text-muted-foreground">
                          Group Name:
                        </span>{" "}
                        {conversationDetail.conversation.groupName}
                      </div>
                    )}
                    {conversationDetail.conversation.participants.length >
                      0 && (
                      <div>
                        <span className="text-muted-foreground">
                          Participants:
                        </span>
                        <ul className="ml-4 mt-1">
                          {conversationDetail.conversation.participants.map(
                            (p, i) => (
                              <li key={i} className="font-mono text-xs">
                                {p}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                    {conversationDetail.conversation.summary && (
                      <div>
                        <span className="text-muted-foreground">Summary:</span>
                        <p className="mt-1 text-foreground">
                          {conversationDetail.conversation.summary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* User Context (for DMs) */}
                {conversationDetail.userContext && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      User Context
                    </h3>
                    <div className="bg-muted rounded-lg p-3 space-y-3 text-sm">
                      {conversationDetail.userContext.timezone && (
                        <div>
                          <span className="text-muted-foreground">
                            Timezone:
                          </span>{" "}
                          {conversationDetail.userContext.timezone}
                        </div>
                      )}

                      {conversationDetail.userContext.summary && (
                        <div>
                          <span className="text-muted-foreground">
                            Summary:
                          </span>
                          <p className="mt-1 text-foreground whitespace-pre-wrap">
                            {conversationDetail.userContext.summary}
                          </p>
                        </div>
                      )}

                      {conversationDetail.userContext.interests.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">
                            Interests:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {conversationDetail.userContext.interests.map(
                              (interest, i) => (
                                <Badge key={i} variant="secondary">
                                  {interest}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      {conversationDetail.userContext.professional && (
                        <div>
                          <span className="text-muted-foreground">
                            Professional:
                          </span>
                          <pre className="mt-1 text-xs bg-card p-2 rounded overflow-x-auto border border-border">
                            {JSON.stringify(
                              conversationDetail.userContext.professional,
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      )}

                      {conversationDetail.userContext.facts &&
                        Array.isArray(conversationDetail.userContext.facts) &&
                        conversationDetail.userContext.facts.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">
                              Facts:
                            </span>
                            <pre className="mt-1 text-xs bg-card p-2 rounded overflow-x-auto max-h-48 border border-border">
                              {JSON.stringify(
                                conversationDetail.userContext.facts,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        )}

                      {conversationDetail.userContext.documents.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">
                            Recent Documents (
                            {conversationDetail.userContext.documents.length}):
                          </span>
                          <div className="mt-1 space-y-2">
                            {conversationDetail.userContext.documents.map(
                              (doc) => (
                                <div
                                  key={doc.id}
                                  className="bg-card p-2 rounded border border-border"
                                >
                                  <div className="font-medium text-xs">
                                    {doc.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Source: {doc.source}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!conversationDetail.userContext &&
                  !conversationDetail.conversation.isGroup && (
                    <div className="text-sm text-muted-foreground italic">
                      No user context available for this conversation
                    </div>
                  )}

                {conversationDetail.conversation.isGroup && (
                  <div className="text-sm text-muted-foreground italic">
                    User context is not available for group chats
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Message Details Dialog */}
        <Dialog
          open={!!selectedMessage}
          onOpenChange={(open) => !open && setSelectedMessage(null)}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Message Details</DialogTitle>
              <DialogDescription>
                Full details for this message from the database
              </DialogDescription>
            </DialogHeader>

            {selectedMessage && (
              <div className="space-y-4 mt-4 overflow-hidden">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label className="text-xs text-muted-foreground">ID</label>
                    <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                      {selectedMessage.id}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <label className="text-xs text-muted-foreground">
                      Role
                    </label>
                    <p className="text-sm">
                      <Badge
                        variant={
                          selectedMessage.role === "assistant"
                            ? "secondary"
                            : selectedMessage.role === "system"
                            ? "outline"
                            : "default"
                        }
                      >
                        {selectedMessage.role}
                      </Badge>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label className="text-xs text-muted-foreground">
                      Created At
                    </label>
                    <p className="text-sm break-all">
                      {new Date(selectedMessage.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <label className="text-xs text-muted-foreground">
                      Sender
                    </label>
                    <p className="text-sm font-mono break-all">
                      {selectedMessage.sender || "—"}
                    </p>
                  </div>
                </div>

                {/* LoopMessage Info */}
                {selectedMessage.role === "assistant" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <label className="text-xs text-muted-foreground">
                        LoopMessage ID
                      </label>
                      <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                        {selectedMessage.messageId || "—"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <label className="text-xs text-muted-foreground">
                        Delivery Status
                      </label>
                      <p className="text-sm">
                        {selectedMessage.deliveryStatus ? (
                          <Badge
                            variant={
                              selectedMessage.deliveryStatus === "sent"
                                ? "default"
                                : selectedMessage.deliveryStatus === "failed" ||
                                  selectedMessage.deliveryStatus === "timeout"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {selectedMessage.deliveryStatus}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {selectedMessage.deliveryError && (
                  <div className="min-w-0">
                    <label className="text-xs text-muted-foreground">
                      Delivery Error
                    </label>
                    <p className="text-sm text-destructive bg-destructive/10 p-2 rounded break-all">
                      {selectedMessage.deliveryError}
                    </p>
                  </div>
                )}

                {/* System Message Info */}
                {selectedMessage.role === "system" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <label className="text-xs text-muted-foreground">
                        Forwarded
                      </label>
                      <p className="text-sm">
                        {selectedMessage.forwarded === true
                          ? "✓ Yes"
                          : selectedMessage.forwarded === false
                          ? "✗ No"
                          : "—"}
                      </p>
                    </div>
                    {selectedMessage.rejectionReason && (
                      <div className="min-w-0">
                        <label className="text-xs text-muted-foreground">
                          Rejection Reason
                        </label>
                        <p className="text-sm text-destructive break-all">
                          {selectedMessage.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments */}
                {selectedMessage.attachments &&
                  selectedMessage.attachments.length > 0 && (
                    <div className="min-w-0">
                      <label className="text-xs text-muted-foreground">
                        Attachments ({selectedMessage.attachments.length})
                      </label>
                      <div className="space-y-1 mt-1">
                        {selectedMessage.attachments.map((url, i) => (
                          <p
                            key={i}
                            className="text-sm font-mono bg-muted p-2 rounded break-all"
                          >
                            {url}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Content */}
                <div className="min-w-0">
                  <label className="text-xs text-muted-foreground">
                    Content (Raw)
                  </label>
                  <pre className="text-sm bg-muted p-3 rounded overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                    {typeof selectedMessage.content === "string"
                      ? selectedMessage.content
                      : JSON.stringify(selectedMessage.content, null, 2)}
                  </pre>
                </div>

                {/* Delete Button */}
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm("Are you sure you want to delete this message?")
                      ) {
                        deleteMutation.mutate(selectedMessage.id);
                        setSelectedMessage(null);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Message
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
