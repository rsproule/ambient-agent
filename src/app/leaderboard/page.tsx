"use client";

import { Loader } from "@/src/components/loader";
import { useQuery } from "@tanstack/react-query";

interface LeaderboardEntry {
  rank: number;
  amount: string;
  displayName: string | null;
  date: string;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalPayouts: number;
  totalAmount: string;
  treasuryBalance: string | null;
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

export default function LeaderboardPage() {
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
                  className="flex items-center px-5 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 text-muted-foreground font-mono text-sm">
                    {entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`truncate ${
                        entry.displayName
                          ? "text-foreground"
                          : "text-muted-foreground italic"
                      }`}
                    >
                      {entry.displayName || "Anonymous"}
                    </p>
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
      </div>
    </div>
  );
}
