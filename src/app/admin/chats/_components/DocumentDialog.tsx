"use client";

import { Badge } from "@/src/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import type { UserContextDocument } from "./types";

interface DocumentDialogProps {
  document: UserContextDocument | null;
  onClose: () => void;
}

export function DocumentDialog({ document, onClose }: DocumentDialogProps) {
  if (!document) return null;

  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
          <DialogDescription>
            <Badge variant="secondary">{document.source}</Badge>
            <span className="ml-2 text-muted-foreground">
              {new Date(document.createdAt).toLocaleString()}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">ID</label>
              <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                {document.id}
              </p>
            </div>
            <div className="min-w-0">
              <label className="text-xs text-muted-foreground">Source</label>
              <p className="text-sm">
                <Badge variant="outline">{document.source}</Badge>
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0">
            <label className="text-xs text-muted-foreground">Content</label>
            <pre className="mt-1 text-sm bg-muted p-4 rounded overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap wrap-break-word">
              {document.content}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
