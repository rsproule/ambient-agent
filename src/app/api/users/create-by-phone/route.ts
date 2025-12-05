import { PrivyClient } from "@privy-io/node";
import { NextRequest, NextResponse } from "next/server";

// Initialize Privy client
const privyClient = new PrivyClient({
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    // Normalize phone number (ensure it starts with +)
    const normalizedPhone = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+${phoneNumber}`;

    // Validate phone number format (basic E.164 validation)
    if (!/^\+[1-9]\d{1,14}$/.test(normalizedPhone)) {
      return NextResponse.json(
        {
          error:
            "Invalid phone number format. Use E.164 format (e.g., +14155551234)",
        },
        { status: 400 },
      );
    }

    // Check if user already exists with this phone number
    const existingUser = await privyClient
      .users()
      .getByPhoneNumber({ number: normalizedPhone })
      .catch(() => null);

    if (existingUser) {
      // User exists, find their embedded wallet
      const embeddedWallet = existingUser.linked_accounts.find(
        (account) =>
          account.type === "wallet" &&
          "wallet_client_type" in account &&
          account.wallet_client_type === "privy",
      );

      return NextResponse.json({
        success: true,
        userId: existingUser.id,
        phoneNumber: normalizedPhone,
        walletAddress:
          embeddedWallet && "address" in embeddedWallet
            ? embeddedWallet.address
            : null,
        isNewUser: false,
      });
    }

    // Create new user with phone number
    // Privy will automatically create an embedded wallet for them
    const newUser = await privyClient.users().create({
      linked_accounts: [
        {
          type: "phone",
          number: normalizedPhone,
        },
      ],
      wallets: [{ chain_type: "ethereum" }],
    });

    // Find the embedded wallet in the new user's linked accounts
    const embeddedWallet = newUser.linked_accounts.find(
      (account) =>
        account.type === "wallet" &&
        "wallet_client_type" in account &&
        account.wallet_client_type === "privy",
    );

    return NextResponse.json({
      success: true,
      userId: newUser.id,
      phoneNumber: normalizedPhone,
      walletAddress:
        embeddedWallet && "address" in embeddedWallet
          ? embeddedWallet.address
          : null,
      isNewUser: true,
    });
  } catch (error) {
    console.error("Error creating user by phone:", error);

    // Handle specific Privy errors
    if (error instanceof Error) {
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          { error: "User with this phone number already exists" },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}
