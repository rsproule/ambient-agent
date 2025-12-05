import { NextRequest, NextResponse } from "next/server";
import { getUsdcBalance } from "@/src/lib/blockchain/usdc";
import type { Address } from "viem";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid address format" },
      { status: 400 }
    );
  }

  try {
    const balance = await getUsdcBalance(address as Address);

    return NextResponse.json({
      balance: {
        raw: balance.raw.toString(),
        formatted: balance.formatted,
        display: balance.display,
      },
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance data" },
      { status: 500 }
    );
  }
}
