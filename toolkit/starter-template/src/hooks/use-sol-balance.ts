"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccountSubscription } from "./use-account-subscription";

/**
 * Fetches the connected wallet's SOL balance via React Query,
 * and keeps it live with a WebSocket subscription.
 */
export function useSolBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const queryKey = ["solBalance", publicKey?.toBase58()];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!publicKey) throw new Error("No wallet connected");
      const lamports = await connection.getBalance(publicKey);
      return lamports / LAMPORTS_PER_SOL;
    },
    enabled: !!publicKey,
    staleTime: 30_000,
    refetchInterval: 60_000, // polling fallback if WebSocket fails
  });

  // Live update via WebSocket — fires when balance changes on-chain
  useAccountSubscription(publicKey, (info) => {
    const sol = info.lamports / LAMPORTS_PER_SOL;
    queryClient.setQueryData(queryKey, sol);
  });

  return query;
}
