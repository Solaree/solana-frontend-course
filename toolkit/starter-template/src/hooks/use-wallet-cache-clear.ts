"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Clears all React Query cache when the connected wallet changes.
 * Prevents stale data from a previous wallet leaking into the current session.
 */
export function useWalletCacheClear() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const currentKey = publicKey?.toBase58() ?? null;

    // Only clear when switching from one wallet to another (not on initial connect)
    if (prevKeyRef.current !== null && currentKey !== prevKeyRef.current) {
      queryClient.clear();
    }

    prevKeyRef.current = currentKey;
  }, [publicKey, queryClient]);
}
