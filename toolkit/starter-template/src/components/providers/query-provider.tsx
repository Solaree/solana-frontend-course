"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useWalletCacheClear } from "@/hooks/use-wallet-cache-clear";

function WalletCacheClear() {
  useWalletCacheClear();
  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,        // data is fresh for 30 s
            gcTime: 5 * 60_000,       // keep unused data in cache for 5 min
            retry: 2,                 // retry failed RPC calls twice
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletCacheClear />
      {children}
    </QueryClientProvider>
  );
}
