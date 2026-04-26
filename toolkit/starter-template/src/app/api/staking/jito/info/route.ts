import { NextResponse } from "next/server";
import type { JitoInfo } from "@/lib/staking";

// Jito's public stats endpoint — same data their app's "Stats" page uses.
// Each field is an array of {data, date} samples; we just want the latest.
const JITO_STATS = "https://kobe.mainnet.jito.network/api/v1/stake_pool_stats";

type Sample = { data: number; date: string };

type StatsResponse = {
  apy?: Sample[];
  // ⚠ Unit inconsistency in Jito's API — verified by hitting the endpoint:
  //   tvl    → lamports        (e.g. 1.04e16  → 10.4M SOL)
  //   supply → whole JitoSOL   (e.g. 8.17e6   → 8.17M JitoSOL, already decimal)
  // Easy to miss because both are "big numbers", but doing tvl/supply
  // straight gives ~1.27e9 instead of the actual ~1.275 SOL per JitoSOL.
  tvl?: Sample[];
  supply?: Sample[];
};

function latest(samples?: Sample[]): number {
  if (!samples || samples.length === 0) return 0;
  return samples[samples.length - 1].data;
}

export async function GET() {
  try {
    const res = await fetch(JITO_STATS, {
      // Re-validate every minute — the stats only update once per slot
      // anyway, no point hammering Jito's API.
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`Jito stats API error ${res.status}`);
    }

    const stats: StatsResponse = await res.json();

    const tvlLamports = latest(stats.tvl);
    const supplyWhole = latest(stats.supply);

    // exchangeRate = SOL per 1 JitoSOL.
    //   tvl is in lamports → divide by 1e9 to get SOL.
    //   supply is already in whole JitoSOL → divide by it directly.
    const exchangeRate =
      supplyWhole > 0 ? tvlLamports / 1e9 / supplyWhole : 1;

    const info: JitoInfo = {
      apy: latest(stats.apy),
      exchangeRate,
      tvlLamports,
      // Convert to base units for downstream consumers that want a
      // consistent "always base units" contract.
      supplyBaseUnits: Math.round(supplyWhole * 1e9),
    };

    return NextResponse.json(info);
  } catch (err) {
    console.error("[staking/jito/info] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
