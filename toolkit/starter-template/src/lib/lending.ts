// ─── Lending token definitions ───────────────────────────────────────────────

export type LendingToken = {
  symbol: string;
  mint: string;      // mainnet mint address
  decimals: number;
  solendSymbol: string; // symbol used by Save Finance / Solend SDK
};

export const LENDING_TOKENS: LendingToken[] = [
  {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    solendSymbol: "SOL",
  },
  {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    solendSymbol: "USDC",
  },
  {
    symbol: "USDT",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    solendSymbol: "USDT",
  },
  // ─── LSTs ──────────────────────────────────────────────────────────────
  // Liquid-staking tokens. Coverage varies by protocol — JitoSOL has a
  // healthy Kamino main-market reserve but isn't in Save's main pool;
  // bSOL is the opposite. The form surfaces a "Not available on X" hint
  // when the user picks a token that the active protocol's market doesn't
  // expose, rather than hiding tokens conditionally (which would make the
  // dropdown jump around when toggling protocols).
  {
    symbol: "JitoSOL",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    decimals: 9,
    solendSymbol: "JitoSOL",
  },
  {
    symbol: "bSOL",
    mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
    decimals: 9,
    solendSymbol: "bSOL",
  },
];

export const KAMINO_MAIN_MARKET =
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";

export const SAVE_MAIN_POOL = "4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY";

// ─── Normalized market reserve (shared between Kamino and Save Finance) ───────

export type LendingReserve = {
  protocol: "kamino" | "save";
  symbol: string;
  mint: string;
  supplyAPY: number;   // as decimal, e.g. 0.05 = 5%
  borrowAPY: number;
  totalSupplyUsd: number;
  utilizationRate: number;
};
