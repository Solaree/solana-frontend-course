"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useQuery } from "@tanstack/react-query";

export interface TokenAccount {
  mint: string;
  address: string;
  decimals: number;
  uiAmount: number;
  rawAmount: bigint;
}

/**
 * Fetches all non-zero SPL token accounts for the connected wallet.
 * Results are sorted by balance descending.
 */
export function useTokenAccounts() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["tokenAccounts", publicKey?.toBase58()],
    queryFn: async (): Promise<TokenAccount[]> => {
      if (!publicKey) return [];

      const { value } = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID },
        "confirmed"
      );

      return value
        .map(({ pubkey, account }) => {
          const info = account.data.parsed.info;
          return {
            mint: info.mint as string,
            address: pubkey.toBase58(),
            decimals: info.tokenAmount.decimals as number,
            uiAmount: (info.tokenAmount.uiAmount ?? 0) as number,
            rawAmount: BigInt(info.tokenAmount.amount as string),
          };
        })
        .filter((t) => t.uiAmount > 0)
        .sort((a, b) => b.uiAmount - a.uiAmount);
    },
    enabled: !!publicKey,
    staleTime: 30_000,
  });
}
