"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";

export interface TransactionRecord {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: boolean;
}

/**
 * Fetches recent transaction signatures for the connected wallet.
 * Returns the latest `limit` transactions sorted newest-first.
 */
export function useTransactionHistory(limit = 10) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["transactionHistory", publicKey?.toBase58(), limit],
    queryFn: async (): Promise<TransactionRecord[]> => {
      if (!publicKey) return [];

      const signatures = await connection.getSignaturesForAddress(
        publicKey,
        { limit },
        "confirmed"
      );

      return signatures.map((sig) => ({
        signature: sig.signature,
        slot: sig.slot,
        blockTime: sig.blockTime ?? null,
        err: !!sig.err,
      }));
    },
    enabled: !!publicKey,
    staleTime: 30_000,
  });
}
