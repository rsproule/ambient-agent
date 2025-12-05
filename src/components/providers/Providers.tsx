"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { base } from "viem/chains";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {privyAppId ? (
          <PrivyProviderBase
            appId={privyAppId}
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
        ) : (
          children
        )}
      </QueryClientProvider>
    </SessionProvider>
  );
}

