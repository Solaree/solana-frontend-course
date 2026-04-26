import { NextResponse } from "next/server";
import { SAVE_MAIN_POOL, type LendingReserve } from "@/lib/lending";

// /v1/markets/configs contains structural config but NO rates.
// /v1/reserves?scope=all contains on-chain state including the `rates` field
// which provides pre-computed supplyInterest / borrowInterest as % strings.
const SAVE_API = "https://api.solend.fi";

// Mint → symbol mapping so we don't rely on the API's nested liquidityToken.
// Keep this in sync with LENDING_TOKENS in src/lib/lending.ts.
// bSOL is in Save's main pool; JitoSOL isn't (it lives in the JLP/LST
// pool which we don't load here). The form surfaces an "unavailable"
// hint when the user picks a token the active protocol doesn't expose.
const SUPPORTED: Record<string, string> = {
  "So11111111111111111111111111111111111111112":     "SOL",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v":   "USDC",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB":   "USDT",
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1":    "bSOL",
};

export async function GET() {
  try {
    // /v1/reserves returns ALL reserves across all pools.
    // Filter by lendingMarket == SAVE_MAIN_POOL client-side.
    const res = await fetch(
      `${SAVE_API}/v1/reserves?scope=all&cluster=mainnet-beta`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) throw new Error(`Save Finance reserves API error ${res.status}`);

    const body: { results: any[] } = await res.json();
    const results = body.results ?? [];

    const reserves: LendingReserve[] = results
      .filter((item: any) => {
        const r = item?.reserve ?? {};
        const mint = r?.liquidity?.mintPubkey ?? "";
        return r.lendingMarket === SAVE_MAIN_POOL && mint in SUPPORTED;
      })
      .map((item: any) => {
        const r     = item.reserve ?? {};
        const rates = item.rates ?? {};
        const mint  = r?.liquidity?.mintPubkey ?? "";
        const symbol = SUPPORTED[mint] ?? "";

        // Compute utilization from raw wads
        const available     = Number(r.liquidity?.availableAmount ?? 0);
        const borrowedWads  = Number(r.liquidity?.borrowedAmountWads ?? 0);
        const borrowed      = borrowedWads / 1e18;
        const total         = available + borrowed;
        const utilizationRate = total > 0 ? borrowed / total : 0;

        // totalSupplyUsd ≈ total tokens × oracle price (wads, 18 decimal)
        const oraclePriceWads = Number(r.liquidity?.marketPrice ?? 0);
        const oraclePrice     = oraclePriceWads / 1e18;
        const decimals        = r.liquidity?.mintDecimals ?? 9;
        const totalTokens     = total / 10 ** decimals;
        const totalSupplyUsd  = totalTokens * oraclePrice;

        // rates.supplyInterest / borrowInterest are % strings, e.g. "2.58"
        const supplyAPY = parseFloat(rates.supplyInterest ?? "0") / 100 || 0;
        const borrowAPY = parseFloat(rates.borrowInterest ?? "0") / 100 || 0;

        return {
          protocol: "save" as const,
          symbol,
          mint,
          supplyAPY,
          borrowAPY,
          totalSupplyUsd,
          utilizationRate,
        };
      });

    return NextResponse.json(reserves);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
