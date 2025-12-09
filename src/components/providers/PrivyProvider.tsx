"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import { base } from "viem/chains";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        loginMethods: ["sms"],
        appearance: {
          theme: "light",
          accentColor: "#0066FF",
          logo: "/whiskerspfp.jpg",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}
