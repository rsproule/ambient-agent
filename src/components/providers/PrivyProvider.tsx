"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import { base } from "viem/chains";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID is not set, Privy features will be disabled");
    return <>{children}</>;
  }

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        // SMS as the only login method
        loginMethods: ["sms"],
        // Appearance customization
        appearance: {
          theme: "light",
          accentColor: "#0066FF",
          logo: "/whiskerspfp.jpg",
          showWalletLoginFirst: false,
        },
        // Create embedded wallets for users automatically (new format)
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        // Default chain is Base
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}

