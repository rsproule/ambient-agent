"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  ChatView,
  ContextSidebar,
  ConversationList,
  deleteMessage,
  DocumentDialog,
  fetchConversation,
  fetchConversations,
  MessageDetailsDialog,
  sendMessage,
  type Message,
  type UserContextDocument,
} from "./_components";

export default function AdminChatsPage() {
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
    refetchInterval: 5000,
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
      <div className="w-full max-w-7xl flex border-x border-border h-[calc(100vh-4rem)]">
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
