"use client";

import { Loader } from "@/src/components/loader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface LeaderboardEntry {
  rank: number;
  amount: string;
  displayName: string | null;
  date: string;
  userId: string;
  isCurrentUser: boolean;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalPayouts: number;
  totalAmount: string;
  treasuryBalance: string | null;
  currentUserId: string | null;
}

async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const response = await fetch("/api/leaderboard?limit=25");
  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard");
  }
  return response.json();
}

function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

async function updateDisplayName(
  displayName: string,
): Promise<{ displayName: string | null }> {
  const response = await fetch("/api/users/display-name", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update display name");
  }
  return response.json();
}

export default function LeaderboardPage() {
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const {
    data: leaderboard,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
  });

  const updateNameMutation = useMutation({
    mutationFn: updateDisplayName,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      setEditingName(false);
      setNewName("");
    },
  });

  const currentUserEntry = leaderboard?.entries.find((e) => e.isCurrentUser);

  const handleStartEdit = () => {
    setNewName(currentUserEntry?.displayName || "");
    setEditingName(true);
  };

  const handleSave = () => {
    updateNameMutation.mutate(newName);
  };

  const handleCancel = () => {
    setEditingName(false);
    setNewName("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-12 pt-28">
        {/* Treasury Balance */}
        <div className="mb-12 text-center">
          <p className="text-muted-foreground text-sm uppercase tracking-wider mb-3">
            Available for Payouts
          </p>
          <p className="text-6xl sm:text-7xl font-black tracking-tight text-foreground tabular-nums">
            {isLoading ? (
              <span className="animate-pulse text-muted-foreground">$—</span>
            ) : leaderboard?.treasuryBalance ? (
              formatAmount(leaderboard.treasuryBalance)
            ) : (
              "$0.00"
            )}
          </p>
          <a
            href="sms:+17243216167&body=Start negotiation for my bonus"
            className="inline-block mt-6 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Negotiate for Your Bonus Now
          </a>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm">
            {isLoading
              ? "—"
              : `${leaderboard?.totalPayouts ?? 0} payouts · ${formatAmount(
                  leaderboard?.totalAmount ?? "0",
                )} distributed`}
          </p>
        </div>

        {/* Leaderboard Table */}
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive text-sm">
                {error instanceof Error
                  ? error.message
                  : "Failed to load leaderboard"}
              </p>
            </div>
          ) : leaderboard?.entries.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No payouts yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {leaderboard?.entries.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center px-5 py-4 hover:bg-muted/50 transition-colors ${
                    entry.isCurrentUser
                      ? "bg-primary/5 border-l-2 border-l-primary"
                      : ""
                  }`}
                >
                  <div className="w-10 text-muted-foreground font-mono text-sm">
                    {entry.rank}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {entry.isCurrentUser && (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                        You
                      </span>
                    )}
                    <p
                      className={`truncate ${
                        entry.displayName
                          ? "text-foreground"
                          : "text-muted-foreground italic"
                      }`}
                    >
                      {entry.displayName || "Anonymous"}
                    </p>
                    {entry.isCurrentUser && (
                      <button
                        onClick={handleStartEdit}
                        className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit display name"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="hidden sm:block text-muted-foreground text-sm mr-6">
                    {formatDate(entry.date)}
                  </div>
                  <div className="text-right font-mono text-foreground tabular-nums">
                    {formatAmount(entry.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Name Modal */}
        {editingName && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Edit Display Name
              </h2>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter your display name"
                maxLength={50}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <p className="text-xs text-muted-foreground mb-4">
                Leave empty to appear as &quot;Anonymous&quot;
              </p>
              {updateNameMutation.error && (
                <p className="text-sm text-destructive mb-4">
                  {updateNameMutation.error instanceof Error
                    ? updateNameMutation.error.message
                    : "Failed to update name"}
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancel}
                  disabled={updateNameMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateNameMutation.isPending}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {updateNameMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
