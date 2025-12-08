"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Skeleton } from "@/src/components/ui/skeleton";
import {
  ChatView,
  ContextSidebar,
  ConversationList,
  deleteMessage,
  DocumentDialog,
  fetchConversation,
  fetchConversations,
  MessageDetailsDialog,
  retryMessage,
  sendMessage,
  type Message,
  type UserContextDocument,
} from "./_components";

// Loading fallback for Suspense
function AdminChatsLoading() {
  return (
    <div className="min-h-screen bg-background flex justify-center pt-16">
      <div className="w-full max-w-7xl flex border-x border-border h-[calc(100vh-4rem)]">
        <div className="w-80 bg-card border-r border-border p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-24" />
          <div className="space-y-3 mt-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      </div>
    </div>
  );
}

// Main page wrapper with Suspense
export default function AdminChatsPage() {
  return (
    <Suspense fallback={<AdminChatsLoading />}>
      <AdminChatsContent />
    </Suspense>
  );
}

function AdminChatsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedConvoId = searchParams.get("chat");

  const [messageInput, setMessageInput] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<UserContextDocument | null>(null);
  const [showContext, setShowContext] = useState(true);
  const queryClient = useQueryClient();

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
    refetchInterval: 2000,
  });

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-conversation", selectedConvoId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-conversations"] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
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

  // Retry message mutation
  const retryMutation = useMutation({
    mutationFn: retryMessage,
    onSuccess: () => {
      // Refetch conversation details after retry (with slight delay for task to complete)
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["admin-conversation", selectedConvoId],
        });
      }, 1000);
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !conversationDetail) return;

    const { conversation } = conversationDetail;
    sendMessageMutation.mutate({
      text: messageInput.trim(),
      ...(conversation.isGroup
        ? { group: conversation.conversationId }
        : { recipient: conversation.conversationId }),
    });
  };

  return (
    <div className="min-h-screen bg-background flex justify-center pt-16">
      <div className="w-full max-w-[2000px] flex border-x border-border h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Conversation List */}
        <ConversationList
          conversations={conversations}
          isLoading={loadingConversations}
          error={conversationsError}
          selectedId={selectedConvoId}
          onSelect={setSelectedConvoId}
        />

        {/* Main Content - Chat View + Context Sidebar */}
        <div className="flex-1 flex h-full overflow-hidden">
          {/* Chat Area */}
          <ChatView
            conversationDetail={conversationDetail}
            isLoading={!!selectedConvoId && loadingDetail}
            error={detailError}
            showContext={showContext}
            onToggleContext={() => setShowContext(!showContext)}
            onMessageClick={setSelectedMessage}
            onDeleteMessage={(id) => deleteMutation.mutate(id)}
            isDeleting={deleteMutation.isPending}
            onRetryMessage={(id) => retryMutation.mutate(id)}
            isRetrying={retryMutation.isPending}
            messageInput={messageInput}
            onMessageInputChange={setMessageInput}
            onSendMessage={handleSendMessage}
            isSending={sendMessageMutation.isPending}
            sendError={sendMessageMutation.error}
          />

          {/* Right Sidebar - Context */}
          {conversationDetail && showContext && (
            <ContextSidebar
              conversationDetail={conversationDetail}
              onDocumentClick={setSelectedDocument}
            />
          )}
        </div>

        {/* Message Details Dialog */}
        <MessageDetailsDialog
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onDelete={(id) => deleteMutation.mutate(id)}
          isDeleting={deleteMutation.isPending}
          onRetry={(id) => retryMutation.mutate(id)}
          isRetrying={retryMutation.isPending}
        />

        {/* Document Dialog */}
        <DocumentDialog
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      </div>
    </div>
  );
}
