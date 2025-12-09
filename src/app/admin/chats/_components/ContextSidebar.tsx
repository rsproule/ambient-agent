"use client";

import { Badge } from "@/src/components/ui/badge";
import { AppWindow, FileText } from "lucide-react";
import type { ConversationDetail, UserContextDocument } from "./types";

interface ContextSidebarProps {
  conversationDetail: ConversationDetail;
  onDocumentClick: (doc: UserContextDocument) => void;
}

export function ContextSidebar({
  conversationDetail,
  onDocumentClick,
}: ContextSidebarProps) {
  return (
    <div className="w-80 border-l border-border bg-card h-full overflow-y-auto shrink-0">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Context</h3>
        <p className="text-xs text-muted-foreground">
          Information injected into AI prompt
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Conversation Info */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">
            Conversation
          </h4>
          <div className="bg-muted rounded-lg p-3 space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">ID:</span>{" "}
              <span className="font-mono break-all">
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
                <span className="text-muted-foreground">Group:</span>{" "}
                {conversationDetail.conversation.groupName}
              </div>
            )}
            {conversationDetail.conversation.participants.length > 0 && (
              <div>
                <span className="text-muted-foreground">Participants:</span>
                <ul className="ml-2 mt-1">
                  {conversationDetail.conversation.participants.map((p, i) => (
                    <li key={i} className="font-mono break-all">
                      {p}
                    </li>
                  ))}
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

        {/* Active App */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">
            Foreground App
          </h4>
          <div className="bg-muted rounded-lg p-3 text-xs">
            {conversationDetail.conversation.currentApp ? (
              <div className="flex items-center gap-2">
                <AppWindow className="w-4 h-4 text-primary" />
                <Badge variant="default" className="text-xs">
                  {conversationDetail.conversation.currentApp}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AppWindow className="w-4 h-4" />
                <span>Default (no app active)</span>
              </div>
            )}
          </div>
        </div>

        {/* User Context */}
        {conversationDetail.userContext && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              User Context
            </h4>
            <div className="bg-muted rounded-lg p-3 space-y-3 text-xs">
              {conversationDetail.userContext.timezone && (
                <div>
                  <span className="text-muted-foreground">Timezone:</span>{" "}
                  {conversationDetail.userContext.timezone}
                </div>
              )}

              {conversationDetail.userContext.summary && (
                <div>
                  <span className="text-muted-foreground">Summary:</span>
                  <p className="mt-1 text-foreground whitespace-pre-wrap">
                    {conversationDetail.userContext.summary}
                  </p>
                </div>
              )}

              {conversationDetail.userContext.interests.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Interests:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {conversationDetail.userContext.interests.map(
                      (interest, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {interest}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              )}

              {conversationDetail.userContext.professional && (
                <div>
                  <span className="text-muted-foreground">Professional:</span>
                  <pre className="mt-1 text-xs bg-card p-2 rounded overflow-x-auto border border-border whitespace-pre-wrap break-all">
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
                    <span className="text-muted-foreground">Facts:</span>
                    <pre className="mt-1 text-xs bg-card p-2 rounded overflow-x-auto max-h-48 overflow-y-auto border border-border whitespace-pre-wrap break-all">
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
                    Documents ({conversationDetail.userContext.documents.length}
                    ):
                  </span>
                  <div className="mt-1 space-y-2">
                    {conversationDetail.userContext.documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => onDocumentClick(doc)}
                        className="bg-card p-2 rounded border border-border cursor-pointer hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                          <div className="font-medium truncate">
                            {doc.title}
                          </div>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          Source: {doc.source}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!conversationDetail.userContext &&
          !conversationDetail.conversation.isGroup && (
            <div className="text-xs text-muted-foreground italic">
              No user context available
            </div>
          )}

        {conversationDetail.conversation.isGroup && (
          <div className="text-xs text-muted-foreground italic">
            User context not available for group chats
          </div>
        )}
      </div>
    </div>
  );
}
