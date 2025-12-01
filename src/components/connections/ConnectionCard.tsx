"use client";

import { Button } from "@/src/components/ui/button";
import type { ProviderConfig } from "@/src/lib/pipedream/providers";
import { Check, Settings } from "lucide-react";
import { useState } from "react";
import { ProactiveSettingsDialog } from "./ProactiveSettingsDialog";

interface Connection {
  id: string;
  provider: string;
  status: "connected" | "disconnected" | "error";
  accountEmail?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
}

interface ConnectionCardProps {
  provider: ProviderConfig;
  connection?: Connection;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectionCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
}: ConnectionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isConnected = connection?.status === "connected";

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      onConnect();
    } finally {
      setIsLoading(false);
    }
  };

  const Icon = provider.icon;

  return (
    <>
      <div className="flex items-center justify-between border-b py-4">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium">{provider.name}</div>
            {isConnected && connection?.accountEmail && (
              <div className="text-xs text-muted-foreground">
                {connection.accountEmail}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Check className="h-5 w-5 text-green-600" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                disabled={isLoading}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={isLoading}
              className="text-xs"
            >
              {isLoading ? "..." : "Connect"}
            </Button>
          )}
        </div>
      </div>

      <ProactiveSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        providerId={provider.id}
        providerName={provider.name}
        onDisconnect={onDisconnect}
      />
    </>
  );
}
