"use client";

import { Loader } from "@/src/components/loader";
import { Button } from "@/src/components/ui/button";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Wallet } from "lucide-react";
import type { Address } from "viem";

interface BalanceData {
  raw: string;
  formatted: string;
  display: string;
}

interface BalanceResponse {
  balance: BalanceData;
}

async function fetchBalanceData(address: string): Promise<BalanceResponse> {
  const response = await fetch(`/api/balance?address=${address}`);
  if (!response.ok) {
    throw new Error("Failed to fetch balance data");
  }
  return response.json();
}

function BalancePageContent() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet?.address as Address | undefined;

  const { data: balanceData, isLoading } = useQuery({
    queryKey: ["balance", walletAddress],
    queryFn: () => fetchBalanceData(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const balance = balanceData?.balance ?? null;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-16">
        <Loader />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 pt-24">
        <div className="rounded-2xl border bg-card p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">View Your Balance</h1>
          <p className="mb-6 text-muted-foreground">
            Sign in with your phone number to access your balance.
          </p>
          <Button onClick={login} size="lg" className="px-8">
            Sign In with SMS
          </Button>
        </div>
      </div>
    );
  }

  if (!walletsReady) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-16">
        <div className="text-center">
          <Loader />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-16">
        <div className="text-center">
          <Loader />
          <p className="mt-4 text-muted-foreground">
            Setting up your account...
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            This may take a moment for new accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 pt-24">
      <div className="rounded-2xl border bg-linear-to-br from-card to-card/50 p-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">Your Balance</p>
        {isLoading && !balance ? (
          <div className="h-20 flex items-center justify-center">
            <Loader />
          </div>
        ) : (
          <p className="text-6xl font-bold tracking-tight mb-8">
            {balance?.display || "$0.00"}
          </p>
        )}

        <Button size="lg" className="gap-2" disabled={true}>
          <ArrowUpRight className="h-4 w-4" />
          Withdraw
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Withdrawals coming soon
        </p>
      </div>
    </div>
  );
}

export default function BalancePage() {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 pt-24">
        <div className="rounded-2xl border bg-card p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Not Configured</h1>
          <p className="mb-4 text-muted-foreground">
            This feature requires additional configuration.
          </p>
        </div>
      </div>
    );
  }

  return <BalancePageContent />;
}
