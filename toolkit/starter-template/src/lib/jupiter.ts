export interface SwapToken {
  symbol: string;
  mint: string;
  decimals: number;
}

/** Popular tokens on Solana — extend as needed. */
export const SWAP_TOKENS: SwapToken[] = [
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  { symbol: "USDG", mint: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", decimals: 6 },
  { symbol: "PYUSD", mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", decimals: 6 },
  { symbol: "JitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", decimals: 9 },
  { symbol: "JTO", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9 },
  { symbol: "mSOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", decimals: 9 },
  { symbol: "bSOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", decimals: 9 },
  { symbol: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6 },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
  { symbol: "WIF", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6 },
  { symbol: "RAY", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6 },
  { symbol: "PYTH", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6 },
  { symbol: "W", mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ", decimals: 6 },
  { symbol: "ORCA", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6 },
  { symbol: "HYPE", mint: "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g", decimals: 9 },
  { symbol: "HNT", mint: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", decimals: 8 },
  { symbol: "TRUMP", mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", decimals: 6 },
];


export const tokenIconCache = new Map<string, string>();

/**
 * Pre-fetches token icons from Jupiter's API and populates the cache.
 * Call this once when your app initializes (e.g., in a layout or provider).
 */
export async function preloadTokenIcons(mints: string[]) {
  const promises = mints.map(async (mint) => {
    if (tokenIconCache.has(mint)) return;
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`);
      const data = await res.json();
      const token = data.find((t: any) => t.id === mint);
      if (token?.icon) tokenIconCache.set(mint, token.icon);
    } catch { }
  });
  await Promise.allSettled(promises);
}

export function tokenIcon(mint: string): string {
  return tokenIconCache.get(mint) || "";
}

/** Quick lookup: mint → SwapToken (for known tokens only). */
export const SWAP_TOKEN_MAP = new Map(
  SWAP_TOKENS.map((t) => [t.mint, t])
);

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}
