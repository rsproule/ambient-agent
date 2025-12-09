import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { blockchainConfig, payoutConfig } from "../config/env";

// Payout token contract address on Base
export const USDC_ADDRESS =
  "0xe207038b08F34b2EDb71668562803754991f529e" as const;
export const USDC_DECIMALS = 6;

// Create a public client for Base
const publicClient = createPublicClient({
  chain: base,
  transport: http(blockchainConfig.baseRpcUrl),
});

// ERC20 ABI for balanceOf and transfer
const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
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

export interface UsdcBalance {
  raw: bigint;
  formatted: string;
  display: string;
}

/**
 * Get USDC balance for an address on Base
 */
export async function getUsdcBalance(address: Address): Promise<UsdcBalance> {
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  const formatted = formatUnits(balance, USDC_DECIMALS);
  const display = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(formatted));

  return {
    raw: balance,
    formatted,
    display,
  };
}

/**
 * Get the treasury wallet's USDC balance (the "bankroll")
 */
export async function getTreasuryBalance(): Promise<UsdcBalance | null> {
  const treasuryAddress = payoutConfig.walletAddress;
  if (!treasuryAddress) {
    return null;
  }
  return getUsdcBalance(treasuryAddress as Address);
}

export interface TransferResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
}

/**
 * Transfer USDC from the treasury wallet to a recipient
 * @param toAddress - Recipient wallet address
 * @param amount - Amount in USDC (e.g., "10.50" for $10.50)
 */
export async function transferUsdc(
  toAddress: Address,
  amount: string,
): Promise<TransferResult> {
  const privateKey = payoutConfig.privateKey;
  const treasuryAddress = payoutConfig.walletAddress;

  if (!privateKey || !treasuryAddress) {
    return {
      success: false,
      error: "Payout wallet not configured",
    };
  }

  try {
    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // Create wallet client for signing transactions
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(blockchainConfig.baseRpcUrl),
    });

    // Parse amount to USDC units (6 decimals)
    const amountInUnits = parseUnits(amount, USDC_DECIMALS);

    // Check treasury balance before transfer
    const balance = await getTreasuryBalance();
    if (!balance || balance.raw < amountInUnits) {
      return {
        success: false,
        error: `Insufficient treasury balance. Available: ${
          balance?.display || "$0.00"
        }, Requested: $${amount}`,
      };
    }

    // Execute the transfer
    const txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [toAddress, amountInUnits],
    });

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "success") {
      return {
        success: true,
        txHash,
      };
    } else {
      return {
        success: false,
        txHash,
        error: "Transaction reverted",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown transfer error",
    };
  }
}
