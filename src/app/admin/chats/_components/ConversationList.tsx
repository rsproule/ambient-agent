"use client";

import { Card } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { MessageSquare, User, Users } from "lucide-react";
import type { ConversationListItem } from "./types";
import { formatRelativeTime } from "./utils";

interface ConversationListProps {
  conversations: ConversationListItem[];
  isLoading: boolean;
  error: Error | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({
  conversations,
  isLoading,
  error,
  selectedId,
  onSelect,
}: ConversationListProps) {
  return (
    <div className="w-80 bg-card border-r border-border flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">Conversations</h1>
        <p className="text-sm text-muted-foreground">
          {conversations.length} total
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-destructive text-sm">{error.message}</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-muted-foreground text-sm">
            No conversations found
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((convo) => (
              <Card
                key={convo.id}
                className={`p-3 rounded-none border-0 cursor-pointer transition-colors ${
                  selectedId === convo.id
                    ? "bg-accent"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => onSelect(convo.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-muted-foreground">
                    {convo.isGroup ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {convo.isGroup
                        ? convo.groupName || "Group Chat"
                        : convo.conversationId}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3" />
                      <span>{convo.messageCount} messages</span>
                      <span>·</span>
                      <span>{formatRelativeTime(convo.lastMessageAt)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
