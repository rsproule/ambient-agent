import { createPublicClient, http, formatUnits, type Address } from "viem";
import { base } from "viem/chains";
import { blockchainConfig } from "../config/env";

// USDC contract address on Base
export const USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const USDC_DECIMALS = 6;

// Create a public client for Base
const publicClient = createPublicClient({
  chain: base,
  transport: http(blockchainConfig.baseRpcUrl),
});

// ERC20 ABI for balanceOf
const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
