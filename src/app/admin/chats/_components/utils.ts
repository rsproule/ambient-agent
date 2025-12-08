// Utility functions for admin chats

export function getMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (typeof content === "object" && content !== null) {
    // Handle structured content (tool calls, actions, etc.)
    const obj = content as Record<string, unknown>;
    if ("actions" in obj && Array.isArray(obj.actions)) {
      // Extract text from actions
      return obj.actions
        .map((action: Record<string, unknown>) => {
          if (action.type === "message" && action.text) {
            return action.text as string;
          }
          return `[${action.type}]`;
        })
        .join(" | ");
    }
    return JSON.stringify(content, null, 2);
  }
  return String(content);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
