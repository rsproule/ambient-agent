"use client";

import { Loader } from "@/src/components/loader";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import {
  type Address,
  createPublicClient,
  encodeFunctionData,
  http,
  parseUnits,
} from "viem";
import { base } from "viem/chains";

const USDC_ADDRESS = "0xe207038b08F34b2EDb71668562803754991f529e" as const;
const USDC_DECIMALS = 6;

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

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
  const queryClient = useQueryClient();

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet?.address as Address | undefined;

  const {
    data: balanceData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["balance", walletAddress],
    queryFn: () => fetchBalanceData(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
  });

  const balance = balanceData?.balance ?? null;

  const resetSendForm = () => {
    setRecipientAddress("");
    setSendAmount("");
    setSendError(null);
    setTxHash(null);
  };

  const handleSend = async () => {
    if (!embeddedWallet || !recipientAddress || !sendAmount) return;

    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      setSendError("Invalid address format");
      return;
    }

    // Validate amount
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setSendError("Invalid amount");
      return;
    }

    // Check balance
    const currentBalance = parseFloat(balance?.formatted || "0");
    if (amount > currentBalance) {
      setSendError("Insufficient balance");
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      // Get the provider from the embedded wallet
      const provider = await embeddedWallet.getEthereumProvider();

      // Encode the transfer function call
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [
          recipientAddress as Address,
          parseUnits(sendAmount, USDC_DECIMALS),
        ],
      });

      // Send the transaction
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: walletAddress,
            to: USDC_ADDRESS,
            data,
          },
        ],
      });

      // Wait for confirmation
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });

      setTxHash(hash as string);
      // Refetch balance after successful send
      queryClient.invalidateQueries({ queryKey: ["balance", walletAddress] });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsSending(false);
    }
  };

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
        ) : error ? (
          <div className="mb-8">
            <p className="text-2xl font-semibold text-red-500 mb-2">
              Unable to load balance
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : (
          <p className="text-6xl font-bold tracking-tight mb-8">
            {balance?.display || "$0.00"}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <Dialog
            open={sendDialogOpen}
            onOpenChange={(open) => {
              setSendDialogOpen(open);
              if (!open) resetSendForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Send className="h-4 w-4" />
                Send
              </Button>
            </DialogTrigger>
            <DialogContent>
              {txHash ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Transaction Sent!
                    </DialogTitle>
                    <DialogDescription>
                      Your USDC has been sent successfully.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      View on BaseScan
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setSendDialogOpen(false);
                        resetSendForm();
                      }}
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Send USDC</DialogTitle>
                    <DialogDescription>
                      Send USDC to any address on Base.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipient">Recipient Address</Label>
                      <Input
                        id="recipient"
                        placeholder="0x..."
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        disabled={isSending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (USDC)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        disabled={isSending}
                      />
                      <p className="text-xs text-muted-foreground">
                        Available: {balance?.display || "$0.00"}
                      </p>
                    </div>
                    {sendError && (
                      <p className="text-sm text-red-500">{sendError}</p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setSendDialogOpen(false)}
                      disabled={isSending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={isSending || !recipientAddress || !sendAmount}
                      className="gap-2"
                    >
                      {isSending ? (
                        <>
                          <Loader />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Button size="lg" className="gap-2" disabled={true} variant="outline">
            <ArrowUpRight className="h-4 w-4" />
            Withdraw
          </Button>
        </div>
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
