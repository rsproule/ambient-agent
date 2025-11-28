"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import type { ProviderConfig } from "@/src/lib/pipedream/providers";
import { useState } from "react";

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

  const isConnected = connection?.status === "connected";

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      onConnect();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      onDisconnect();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{provider.icon}</span>
            <div>
              <CardTitle className="text-xl">{provider.name}</CardTitle>
              <CardDescription className="mt-1">
                {provider.description}
              </CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge variant="default" className="bg-green-500">
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connection?.accountEmail && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Account:</span>{" "}
              {connection.accountEmail}
            </div>
          )}

          {connection?.lastSyncedAt && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Last synced:</span>{" "}
              {new Date(connection.lastSyncedAt).toLocaleDateString()}
            </div>
          )}

          <div className="flex gap-2">
            {isConnected ? (
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                {isLoading ? "Disconnecting..." : "Disconnect"}
              </Button>
            ) : (
              <Button onClick={handleConnect} disabled={isLoading}>
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
            )}
          </div>

          {provider.scopes.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Permissions requested
              </summary>
              <ul className="mt-2 space-y-1 pl-4">
                {provider.scopes.map((scope) => (
                  <li key={scope} className="list-disc">
                    {scope}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
