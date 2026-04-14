"use client";

import { useQuery } from "@tanstack/react-query";

const WSOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Fetches USD prices for a list of token mints via our server-side
 * Jupiter proxy (/api/prices). SOL (wSOL mint) is always included.
 *
 * Returns a Map: mint → USD price.
 */
export function useTokenPrices(mints: string[] = []) {
  // Always include SOL, deduplicate
  const allMints = Array.from(new Set([WSOL_MINT, ...mints]));
  const key = allMints.sort().join(",");

  return useQuery({
    queryKey: ["tokenPrices", key],
    queryFn: async (): Promise<Record<string, number>> => {
      const res = await fetch(`/api/prices?ids=${allMints.join(",")}`);

      if (!res.ok) {
        throw new Error("Failed to fetch token prices");
      }

      return res.json();
    },
    staleTime: 30_000,        // 30 seconds
    refetchInterval: 60_000,  // refresh every minute
    retry: 2,
  });
}

/**
 * Convenience: get SOL USD price from the prices map.
 */
export function getSolPrice(prices: Record<string, number> | undefined): number | undefined {
  return prices?.[WSOL_MINT];
}

export { WSOL_MINT };
