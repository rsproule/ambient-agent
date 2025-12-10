"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Check,
  ExternalLink,
  FolderGit2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface WorkspaceCardProps {
  onClaimed?: () => void;
  onReset?: () => void;
}

export function WorkspaceCard({ onClaimed, onReset }: WorkspaceCardProps) {
  const [workspaceUsername, setWorkspaceUsername] = useState<string | null>(
    null,
  );
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<{
    available: boolean;
    reason?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current workspace status
  useEffect(() => {
    async function fetchWorkspace() {
      try {
        const response = await fetch("/api/workspace");
        if (response.ok) {
          const data = await response.json();
          setWorkspaceUsername(data.workspaceUsername);
          setRepoUrl(data.repoUrl);
        }
      } catch (err) {
        console.error("Error fetching workspace:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchWorkspace();
  }, []);

  // Debounced availability check
  const checkAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 2) {
      setAvailability(null);
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch(
        `/api/workspace/check?username=${encodeURIComponent(username)}`,
      );
      const data = await response.json();
      setAvailability(data);
    } catch {
      setAvailability(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Debounce the input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue) {
        checkAvailability(inputValue);
      } else {
        setAvailability(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, checkAvailability]);

  const handleClaim = async () => {
    if (!inputValue || !availability?.available) return;

    setIsClaiming(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inputValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to claim workspace");
        return;
      }

      setWorkspaceUsername(data.workspaceUsername);
      setRepoUrl(data.repoUrl);
      onClaimed?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to claim workspace",
      );
    } finally {
      setIsClaiming(false);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Are you sure you want to reset your workspace? This will remove all files and restore the initial structure. Git history will be preserved.",
      )
    ) {
      return;
    }

    setIsResetting(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace/reset", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset workspace");
        return;
      }

      onReset?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset workspace",
      );
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-between border-b py-4">
        <div className="flex items-center gap-3">
          <FolderGit2 className="h-5 w-5 text-muted-foreground" />
          <div className="font-medium">Claude Workspace</div>
        </div>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  // Already claimed
  if (workspaceUsername) {
    return (
      <div className="border-b py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderGit2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Claude Workspace</div>
              <div className="text-xs text-muted-foreground">
                MeritSpace/{workspaceUsername}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            {repoUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isResetting}
              title="Reset workspace to initial state"
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  // Claim form
  return (
    <div className="border-b py-4">
      <div className="flex items-center gap-3 mb-3">
        <FolderGit2 className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="font-medium">Claude Workspace</div>
          <div className="text-xs text-muted-foreground">
            Claim a persistent workspace for Claude to use
          </div>
        </div>
      </div>

      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <div className="flex items-center">
            <span className="text-sm text-muted-foreground mr-1">
              MeritSpace/
            </span>
            <Input
              placeholder="your-username"
              value={inputValue}
              onChange={(e) => {
                setInputValue(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                );
                setError(null);
              }}
              className="flex-1"
              disabled={isClaiming}
            />
          </div>
          {isChecking && (
            <p className="text-xs text-muted-foreground mt-1">Checking...</p>
          )}
          {!isChecking && availability && (
            <p
              className={`text-xs mt-1 ${
                availability.available ? "text-green-600" : "text-red-600"
              }`}
            >
              {availability.available
                ? "✓ Available"
                : availability.reason || "Username is taken"}
            </p>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <Button
          size="sm"
          onClick={handleClaim}
          disabled={!availability?.available || isClaiming}
          className="text-xs"
        >
          {isClaiming ? <Loader2 className="h-3 w-3 animate-spin" /> : "Claim"}
        </Button>
      </div>
    </div>
  );
}
