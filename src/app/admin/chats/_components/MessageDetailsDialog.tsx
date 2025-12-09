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
import { useMutation } from "@tanstack/react-query";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { checkMessageStatus, type LoopMessageStatus } from "./api";
import type { Message } from "./types";

interface MessageDetailsDialogProps {
  message: Message | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  onRetry?: (id: string) => void;
  isRetrying?: boolean;
}

export function MessageDetailsDialog({
  message,
  onClose,
  onDelete,
  isDeleting,
  onRetry,
  isRetrying,
}: MessageDetailsDialogProps) {
  const [loopStatus, setLoopStatus] = useState<LoopMessageStatus | null>(null);
  const [trackedMessageId, setTrackedMessageId] = useState(message?.id);

  const checkStatusMutation = useMutation({
    mutationFn: checkMessageStatus,
    onSuccess: (data) => {
      setLoopStatus(data.status);
    },
  });

  // Reset state when message changes (derived state pattern)
  if (trackedMessageId !== message?.id) {
    setTrackedMessageId(message?.id);
    setLoopStatus(null);
    checkStatusMutation.reset();
  }

  // Auto-fetch status for assistant messages with messageId
  useEffect(() => {
    if (message?.role === "assistant" && message?.messageId) {
      checkStatusMutation.mutate(message.id);
    }
  }, [message?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
              <label className="text-xs text-muted-foreground">
                Created At
              </label>
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
            <>
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
                    Delivery Status (Local)
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

              {/* Remote Status from LoopMessage API */}
              {message.messageId && (
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground font-medium">
                      Remote Status (LoopMessage API)
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => checkStatusMutation.mutate(message.id)}
                      disabled={checkStatusMutation.isPending}
                      title="Refresh status"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${
                          checkStatusMutation.isPending ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                  </div>

                  {checkStatusMutation.isPending && !loopStatus && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading status...
                    </div>
                  )}

                  {checkStatusMutation.error && (
                    <p className="text-sm text-destructive">
                      {checkStatusMutation.error instanceof Error
                        ? checkStatusMutation.error.message
                        : "Failed to check status"}
                    </p>
                  )}

                  {loopStatus && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge
                          variant={
                            loopStatus.status === "sent"
                              ? "default"
                              : loopStatus.status === "failed" ||
                                loopStatus.status === "timeout"
                              ? "destructive"
                              : loopStatus.status === "processing" ||
                                loopStatus.status === "scheduled"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {loopStatus.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">
                            Recipient:
                          </span>{" "}
                          <span className="font-mono">
                            {loopStatus.recipient}
                          </span>
                        </div>
                        {loopStatus.last_update && (
                          <div>
                            <span className="text-muted-foreground">
                              Last Update:
                            </span>{" "}
                            {new Date(loopStatus.last_update).toLocaleString()}
                          </div>
                        )}
                        {loopStatus.sender_name && (
                          <div>
                            <span className="text-muted-foreground">
                              Sender:
                            </span>{" "}
                            {loopStatus.sender_name}
                          </div>
                        )}
                        {loopStatus.sandbox !== undefined && (
                          <div>
                            <span className="text-muted-foreground">
                              Sandbox:
                            </span>{" "}
                            {loopStatus.sandbox ? "Yes" : "No"}
                          </div>
                        )}
                      </div>
                      {loopStatus.error_code && (
                        <div className="text-destructive text-xs">
                          <span className="text-muted-foreground">
                            Error Code:
                          </span>{" "}
                          {loopStatus.error_code}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
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
                <label className="text-xs text-muted-foreground">
                  Forwarded
                </label>
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
            <label className="text-xs text-muted-foreground">
              Content (Raw)
            </label>
            <pre className="text-sm bg-muted p-3 rounded overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
              {typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content, null, 2)}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-border flex gap-2">
            {/* Retry Button (only for failed/timeout messages) */}
            {message.role === "assistant" &&
              (message.deliveryStatus === "failed" ||
                message.deliveryStatus === "timeout") &&
              onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onRetry(message.id);
                    onClose();
                  }}
                  disabled={isRetrying}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${
                      isRetrying ? "animate-spin" : ""
                    }`}
                  />
                  Retry Send
                </Button>
              )}
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
