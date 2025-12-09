"use client";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { ConversationInfo } from "./types";

interface DeleteConversationDialogProps {
  conversation: ConversationInfo | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  isDeleting: boolean;
}

export function DeleteConversationDialog({
  conversation,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteConversationDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");

  if (!conversation) return null;

  // For groups: confirmation is the number of participants
  // For DMs: confirmation is the phone number
  const confirmationValue = conversation.isGroup
    ? String(conversation.participants.length)
    : conversation.conversationId;

  const isConfirmed = confirmInput === confirmationValue;

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm(conversation.id);
    }
  };

  const handleClose = () => {
    setConfirmInput("");
    onClose();
  };

  return (
    <Dialog open={!!conversation} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">
            Delete Conversation
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the
            conversation and all {conversation.isGroup ? "group " : ""}messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              {conversation.isGroup ? "Group Chat" : "Direct Message"}
            </div>
            {conversation.isGroup && conversation.groupName && (
              <div>
                <span className="text-muted-foreground">Group:</span>{" "}
                {conversation.groupName}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">
                {conversation.isGroup ? "Participants:" : "Phone:"}
              </span>{" "}
              <span className="font-mono">
                {conversation.isGroup
                  ? `${conversation.participants.length} members`
                  : conversation.conversationId}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Type{" "}
              <span className="font-mono font-bold text-destructive">
                {confirmationValue}
              </span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={
                conversation.isGroup ? "Number of participants" : "Phone number"
              }
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Conversation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
