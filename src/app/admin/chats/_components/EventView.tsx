"use client";

import { Badge } from "@/src/components/ui/badge";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  AlertCircle,
  AppWindow,
  ArrowDownToLine,
  ArrowUpFromLine,
  Cog,
  MessageSquare,
  Wrench,
} from "lucide-react";
import type { Event } from "./types";

const EVENT_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  message_in: {
    icon: <ArrowDownToLine className="w-3 h-3" />,
    color: "bg-blue-500/20 text-blue-500",
    label: "Message In",
  },
  message_out: {
    icon: <ArrowUpFromLine className="w-3 h-3" />,
    color: "bg-green-500/20 text-green-500",
    label: "Message Out",
  },
  app_launch: {
    icon: <AppWindow className="w-3 h-3" />,
    color: "bg-purple-500/20 text-purple-500",
    label: "App Launch",
  },
  app_exit: {
    icon: <AppWindow className="w-3 h-3" />,
    color: "bg-purple-500/20 text-purple-500",
    label: "App Exit",
  },
  app_event: {
    icon: <AppWindow className="w-3 h-3" />,
    color: "bg-purple-500/20 text-purple-500",
    label: "App Event",
  },
  tool_call: {
    icon: <Wrench className="w-3 h-3" />,
    color: "bg-orange-500/20 text-orange-500",
    label: "Tool Call",
  },
  system: {
    icon: <Cog className="w-3 h-3" />,
    color: "bg-gray-500/20 text-gray-500",
    label: "System",
  },
  error: {
    icon: <AlertCircle className="w-3 h-3" />,
    color: "bg-red-500/20 text-red-500",
    label: "Error",
  },
};

function getEventConfig(type: string) {
  return (
    EVENT_TYPE_CONFIG[type] || {
      icon: <MessageSquare className="w-3 h-3" />,
      color: "bg-muted text-muted-foreground",
      label: type,
    }
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface EventViewProps {
  events: Event[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function EventView({ events, isLoading, error }: EventViewProps) {
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        Failed to load events
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No events recorded for this conversation
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {events.map((event) => {
        const config = getEventConfig(event.type);
        return (
          <div
            key={event.id}
            className="bg-muted rounded-lg p-3 text-sm space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge className={`${config.color} gap-1`}>
                  {config.icon}
                  {config.label}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {event.source}
                </span>
              </div>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatDate(event.createdAt)}
              </span>
            </div>
            <pre className="text-xs bg-card p-2 rounded overflow-x-auto max-h-32 overflow-y-auto border border-border whitespace-pre-wrap break-all">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
