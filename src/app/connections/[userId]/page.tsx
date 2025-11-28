"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectionCard } from "@/src/components/connections/ConnectionCard";
import { getAllProviders, type ProviderConfig } from "@/src/lib/pipedream/providers";
import { Loader } from "@/src/components/loader";

interface Connection {
  id: string;
  provider: string;
  status: "connected" | "disconnected" | "error";
  accountEmail?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
}

export default function ConnectionsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const providers = getAllProviders();

  // Handle success/error notifications from OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      setNotification({
        type: "success",
        message: `Successfully connected ${success}!`,
      });
      // Clear the query params
      router.replace(`/connections/${userId}`);
    }

    if (error) {
      setNotification({
        type: "error",
        message: `Failed to connect: ${error}`,
      });
      router.replace(`/connections/${userId}`);
    }
  }, [searchParams, router, userId]);

  // Fetch connections
  useEffect(() => {
    async function fetchConnections() {
      try {
        const response = await fetch(`/api/connections?userId=${userId}`);
        if (!response.ok) throw new Error("Failed to fetch connections");
        const data = await response.json();
        setConnections(data.connections || []);
      } catch (error) {
        console.error("Error fetching connections:", error);
        setNotification({
          type: "error",
          message: "Failed to load connections",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchConnections();
  }, [userId]);

  const handleConnect = async (provider: ProviderConfig) => {
    try {
      const response = await fetch(`/api/connections/${provider.id}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error("Failed to initiate connection");

      const data = await response.json();
      // Open OAuth popup
      window.location.href = data.connectUrl;
    } catch (error) {
      console.error("Error connecting:", error);
      setNotification({
        type: "error",
        message: "Failed to initiate connection",
      });
    }
  };

  const handleDisconnect = async (provider: ProviderConfig) => {
    if (!confirm(`Are you sure you want to disconnect ${provider.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/connections/${provider.id}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error("Failed to disconnect");

      // Refresh connections
      setConnections((prev) =>
        prev.map((conn) =>
          conn.provider === provider.id
            ? { ...conn, status: "disconnected" as const }
            : conn
        )
      );

      setNotification({
        type: "success",
        message: `Successfully disconnected ${provider.name}`,
      });
    } catch (error) {
      console.error("Error disconnecting:", error);
      setNotification({
        type: "error",
        message: "Failed to disconnect",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12 pt-24">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Connected Accounts</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Connect your accounts to enable integrations
        </p>
      </div>

      {notification && (
        <div
          className={`mb-6 rounded-lg p-4 ${
            notification.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <p>{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-lg font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {providers.map((provider) => {
          const connection = connections.find(
            (c) => c.provider === provider.id
          );

          return (
            <ConnectionCard
              key={provider.id}
              provider={provider}
              connection={connection}
              userId={userId}
              onConnect={() => handleConnect(provider)}
              onDisconnect={() => handleDisconnect(provider)}
            />
          );
        })}
      </div>

      <div className="mt-12 rounded-lg border bg-muted/50 p-6">
        <h2 className="text-xl font-semibold mb-3">About Connections</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            • All connections are secured using OAuth 2.0 and managed through Pipedream
          </p>
          <p>
            • Your credentials are encrypted and stored securely
          </p>
          <p>
            • You can disconnect any account at any time
          </p>
          <p>
            • Permissions are only used for the features you enable
          </p>
        </div>
      </div>
    </div>
  );
}

