"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Send,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { ConversationDetail, Message } from "./types";
import { formatDate, getMessageText } from "./utils";

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

interface ChatViewProps {
  conversationDetail: ConversationDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  showContext: boolean;
  onToggleContext: () => void;
  onMessageClick: (message: Message) => void;
  onRetryMessage: (id: string) => void;
  isRetrying: boolean;
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onSendMessage: () => void;
  isSending: boolean;
  sendError: Error | null;
}

export function ChatView({
  conversationDetail,
  isLoading,
  error,
  showContext,
  onToggleContext,
  onMessageClick,
  onRetryMessage,
  isRetrying,
  messageInput,
  onMessageInputChange,
  onSendMessage,
  isSending,
  sendError,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages load or change
  useEffect(() => {
    if (conversationDetail?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [conversationDetail?.messages]);

  // Header with toggle button (shown in all states when conversation exists)
  const header = conversationDetail ? (
    <div className="bg-card border-b border-border p-4 flex items-center justify-between shrink-0">
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-foreground truncate">
          {conversationDetail.conversation.isGroup
            ? conversationDetail.conversation.groupName || "Group Chat"
            : conversationDetail.conversation.conversationId}
        </h2>
        <p className="text-sm text-muted-foreground">
          {conversationDetail.messages.length} messages
          {conversationDetail.conversation.isGroup &&
            ` · ${conversationDetail.conversation.participants.length} participants`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleContext}
        title={showContext ? "Hide context" : "Show context"}
        className="shrink-0"
      >
        {showContext ? (
          <PanelRightClose className="w-4 h-4" />
        ) : (
          <PanelRightOpen className="w-4 h-4" />
        )}
      </Button>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-card h-full overflow-hidden">
        {header}
        <div className="flex-1 p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-3/4" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col bg-card h-full overflow-hidden">
        {header}
        <div className="flex-1 flex items-center justify-center text-destructive">
          Failed to load conversation
        </div>
      </div>
    );
  }

  if (!conversationDetail) {
    return (
      <div className="flex-1 flex flex-col bg-card h-full overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a conversation to view messages
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-card h-full overflow-hidden">
      {header}

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
              onClick={() => onMessageClick(msg)}
              className={`rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ${
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
              {/* Message content */}
              <div className="whitespace-pre-wrap text-wrap text-sm overflow-hidden">
                {getMessageText(msg.content)}
              </div>

              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.attachments.map((url, idx) => (
                    <div key={idx} className="rounded overflow-hidden">
                      {url.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) ||
                      url.includes("image") ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Attachment ${idx + 1}`}
                            className="max-w-full max-h-48 rounded object-contain"
                            onError={(e) => {
                              // If image fails to load, show a link instead
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              target.nextElementSibling?.classList.remove(
                                "hidden",
                              );
                            }}
                          />
                          <span className="hidden text-xs underline">
                            View attachment
                          </span>
                        </a>
                      ) : (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs underline hover:opacity-80"
                        >
                          Attachment {idx + 1}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Timestamp, delivery status, and actions */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-xs shrink-0 ${
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
                {/* Retry button for failed messages */}
                {msg.role === "assistant" &&
                  (msg.deliveryStatus === "failed" ||
                    msg.deliveryStatus === "timeout") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryMessage(msg.id);
                      }}
                      disabled={isRetrying}
                      className="shrink-0 p-1 rounded hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-primary"
                      title="Retry sending"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${
                          isRetrying ? "animate-spin" : ""
                        }`}
                      />
                    </button>
                  )}
              </div>
            </div>
          </div>
        ))}
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Send message input */}
      <div className="p-4 border-t border-border bg-card shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={messageInput}
            onChange={(e) => onMessageInputChange(e.target.value)}
            placeholder="Send as Mr. Whiskers..."
            disabled={isSending}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!messageInput.trim() || isSending}
            size="icon"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        {sendError && (
          <p className="text-destructive text-xs mt-2">
            {sendError.message || "Failed to send"}
          </p>
        )}
      </div>
    </div>
  );
}
