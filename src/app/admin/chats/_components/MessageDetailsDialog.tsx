"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Trash2 } from "lucide-react";
import type { Message } from "./types";

interface MessageDetailsDialogProps {
  message: Message | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function MessageDetailsDialog({
  message,
  onClose,
  onDelete,
  isDeleting,
}: MessageDetailsDialogProps) {
  if (!message) return null;

  return (
    <Dialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message Details</DialogTitle>
          <DialogDescription>
            Full details for this message from the database
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 overflow-hidden">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">ID</label>
              <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                {message.id}
              </p>
            </div>
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">Role</label>
              <p className="text-sm">
                <Badge
                  variant={
                    message.role === "assistant"
                      ? "secondary"
                      : message.role === "system"
                      ? "outline"
                      : "default"
                  }
                >
                  {message.role}
                </Badge>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">Created At</label>
              <p className="text-sm break-all">
                {new Date(message.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">Sender</label>
              <p className="text-sm font-mono break-all">
                {message.sender || "—"}
              </p>
            </div>
          </div>

          {/* LoopMessage Info */}
          {message.role === "assistant" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">
                  LoopMessage ID
                </label>
                <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                  {message.messageId || "—"}
                </p>
              </div>
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">
                  Delivery Status
                </label>
                <p className="text-sm">
                  {message.deliveryStatus ? (
                    <Badge
                      variant={
                        message.deliveryStatus === "sent"
                          ? "default"
                          : message.deliveryStatus === "failed" ||
                            message.deliveryStatus === "timeout"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {message.deliveryStatus}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>
          )}

          {message.deliveryError && (
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">
                Delivery Error
              </label>
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded break-all">
                {message.deliveryError}
              </p>
            </div>
          )}

          {/* System Message Info */}
          {message.role === "system" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Forwarded</label>
                <p className="text-sm">
                  {message.forwarded === true
                    ? "✓ Yes"
                    : message.forwarded === false
                    ? "✗ No"
                    : "—"}
                </p>
              </div>
              {message.rejectionReason && (
                <div className="min-w-0">
                  <label className="text-xs text-muted-foreground">
                    Rejection Reason
                  </label>
                  <p className="text-sm text-destructive break-all">
                    {message.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">
                Attachments ({message.attachments.length})
              </label>
              <div className="space-y-1 mt-1">
                {message.attachments.map((url, i) => (
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
            <label className="text-xs text-muted-foreground">Content (Raw)</label>
            <pre className="text-sm bg-muted p-3 rounded overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
              {typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content, null, 2)}
            </pre>
          </div>

          {/* Delete Button */}
          <div className="pt-4 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to delete this message?")) {
                  onDelete(message.id);
                  onClose();
                }
              }}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
