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
import { Loader2 } from "lucide-react";
import type { ConversationInfo } from "./types";

interface ResetNegotiationDialogProps {
  conversation: ConversationInfo | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  isResetting: boolean;
}

export function ResetNegotiationDialog({
  conversation,
  onClose,
  onConfirm,
  isResetting,
}: ResetNegotiationDialogProps) {
  if (!conversation) return null;

  // Only allow for DMs (not groups)
  if (conversation.isGroup) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm(conversation.id);
  };

  return (
    <Dialog open={!!conversation} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Negotiation</DialogTitle>
          <DialogDescription>
            This will allow the user to negotiate for their bonus again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Phone:</span>{" "}
              <span className="font-mono">{conversation.conversationId}</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>This action will:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Delete any existing payout records</li>
              <li>Delete all negotiation offers</li>
              <li>Reset negotiation app state</li>
              <li>Reset onboarding status (allow re-negotiation)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isResetting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isResetting}>
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Negotiation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
