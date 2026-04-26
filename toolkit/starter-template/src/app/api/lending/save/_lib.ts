// Shared helpers for Save Finance deposit/withdraw routes.
// Pool and reserve config shapes come from the Save Finance REST API.

import { SAVE_MAIN_POOL } from "@/lib/lending";

const SAVE_API = "https://api.solend.fi";

// ── Pool config types ──────────────────────────────────────────────────────
// These match InputPoolType / InputReserveType from solend-sdk/core/actions.d.ts
// so they can be passed directly to SolendActionCore.build*Txns().

export type SavePool = {
  name: string;             // required by InputPoolType
  address: string;
  authorityAddress: string;
  owner: string;
  reserves: SaveReserveConfig[];
};

// Minimal shape that InputPoolReserveType requires (for the pool.reserves array)
export type SaveReserveConfig = {
  address: string;
  mintAddress: string;
  liquidityFeeReceiverAddress: string;
  pythOracle: string;
  switchboardOracle: string;
  extraOracle?: string;
};

// Full reserve shape needed by InputReserveType (passed as the second arg)
export type SaveReserve = {
  address: string;
  mintAddress: string;          // liquidityToken.mint
  symbol: string;               // liquidityToken.symbol
  liquidityAddress: string;     // liquidityAddress
  cTokenMint: string;           // collateralMintAddress
  cTokenLiquidityAddress: string; // collateralSupplyAddress
  pythOracle: string;
  switchboardOracle: string;
  liquidityFeeReceiverAddress: string;
};

let cachedPool: SavePool | null = null;
let cacheExpiry = 0;

/** Fetches and caches the main Save Finance pool config (60 s TTL). */
export async function getSavePoolConfig(): Promise<SavePool> {
  if (cachedPool && Date.now() < cacheExpiry) return cachedPool;

  const res = await fetch(
    `${SAVE_API}/v1/markets/configs?scope=all&cluster=mainnet-beta`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error(`Save Finance config API error ${res.status}`);

  const markets: any[] = await res.json();
  const main = markets.find(
    (m: any) => m.address === SAVE_MAIN_POOL || m.name === "main"
  );

  if (!main) throw new Error("Save Finance main pool not found");

  // Map the raw API shape to the shapes solend-sdk expects.
  // /v1/markets/configs reserves have nested `liquidityToken` and
  // `collateralMintAddress` / `collateralSupplyAddress` instead of the
  // flat names defined in InputReserveType / InputPoolReserveType.
  const reserves: SaveReserveConfig[] = (main.reserves ?? []).map((r: any) => ({
    address:                   r.address,
    mintAddress:               r.liquidityToken?.mint ?? r.mintAddress ?? "",
    liquidityFeeReceiverAddress: r.liquidityFeeReceiverAddress ?? "",
    pythOracle:                r.pythOracle ?? "11111111111111111111111111111111",
    switchboardOracle:         r.switchboardOracle ?? "11111111111111111111111111111111",
    extraOracle:               r.extraOracle,
  }));

  cachedPool = {
    name:             main.name ?? "main",
    address:          main.address,
    authorityAddress: main.authorityAddress,
    owner:            main.owner,
    reserves,
  };
  cacheExpiry = Date.now() + 60_000;
  return cachedPool;
}

/**
 * Finds a full SaveReserve by mint address or symbol, fetching the
 * live configs again so we have every field InputReserveType needs.
 */
export async function findReserve(
  pool: SavePool,
  mintOrSymbol: string
): Promise<SaveReserve> {
  // Re-fetch configs (cached) to get the full per-reserve fields that the
  // pool.reserves slice omits.
  const res = await fetch(
    `${SAVE_API}/v1/markets/configs?scope=all&cluster=mainnet-beta`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Save Finance config API error ${res.status}`);

  const markets: any[] = await res.json();
  const main = markets.find(
    (m: any) => m.address === SAVE_MAIN_POOL || m.name === "main"
  );
  if (!main) throw new Error("Save Finance main pool not found");

  const raw = (main.reserves ?? []).find((r: any) => {
    const mint   = r.liquidityToken?.mint ?? r.mintAddress ?? "";
    const symbol = r.liquidityToken?.symbol ?? r.symbol ?? "";
    return (
      mint === mintOrSymbol ||
      symbol.toLowerCase() === mintOrSymbol.toLowerCase()
    );
  });

  if (!raw) throw new Error(`Reserve for ${mintOrSymbol} not found in Save Finance`);

  return {
    address:                   raw.address,
    mintAddress:               raw.liquidityToken?.mint ?? raw.mintAddress ?? "",
    symbol:                    raw.liquidityToken?.symbol ?? raw.symbol ?? "",
    liquidityAddress:          raw.liquidityAddress ?? "",
    cTokenMint:                raw.collateralMintAddress ?? raw.cTokenMint ?? "",
    cTokenLiquidityAddress:    raw.collateralSupplyAddress ?? raw.cTokenLiquidityAddress ?? "",
    pythOracle:                raw.pythOracle ?? "11111111111111111111111111111111",
    switchboardOracle:         raw.switchboardOracle ?? "11111111111111111111111111111111",
    liquidityFeeReceiverAddress: raw.liquidityFeeReceiverAddress ?? "",
  };
}
