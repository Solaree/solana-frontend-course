import { NextResponse } from "next/server";
import {
  address,
  createSolanaRpc,
} from "@solana/kit";
import {
  KaminoMarket,
  PROGRAM_ID,
} from "@kamino-finance/klend-sdk";
import { KAMINO_MAIN_MARKET, type LendingReserve } from "@/lib/lending";

// Kamino has no public REST endpoint for per-reserve APY.
// Load the market directly via the klend-sdk (same RPC call that the
// deposit/withdraw routes already make) and derive APY from on-chain state.
// Cache at the route level so repeated page visits reuse the data.
export const revalidate = 60; // ISR: re-fetch at most once per minute

// Keep this in sync with LENDING_TOKENS in src/lib/lending.ts.
// JitoSOL has a real reserve in Kamino's main market; bSOL doesn't, but we
// list it anyway — the form's "Not available on this protocol" hint kicks
// in for unsupported tokens, which is preferable to having the dropdown
// re-shuffle when the user toggles between Kamino and Save.
const SUPPORTED = new Set(["SOL", "USDC", "USDT", "JITOSOL", "BSOL"]);

function getRpcEndpoint() {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

export async function GET() {
  try {
    const rpc = createSolanaRpc(getRpcEndpoint());
    const marketAddress = address(KAMINO_MAIN_MARKET);

    const market = await KaminoMarket.load(
      rpc as any,
      marketAddress,
      460,
      PROGRAM_ID
    );
    if (!market) throw new Error("Kamino market not found");

    // getSlot is needed for per-slot APY calculations
    const currentSlot = await rpc.getSlot().send();

    const reserves: LendingReserve[] = market
      .getReserves()
      .filter((r) => {
        const sym: string = r.stats?.symbol ?? "";
        return SUPPORTED.has(sym.toUpperCase());
      })
      .map((r) => {
        const stats = r.stats ?? ({} as any);
        const sym: string = stats.symbol ?? "";
        const mint: string = stats.mintAddress?.toString() ?? "";

        // totalSupplyAPY / totalBorrowAPY return a Decimal (or number)
        let supplyAPY = 0;
        let borrowAPY = 0;
        try {
          supplyAPY = Number(r.totalSupplyAPY(currentSlot));
          borrowAPY = Number(r.totalBorrowAPY(currentSlot));
        } catch {
          // If the reserve hasn't loaded rewards yet, fall back to raw APR
        }

        // Utilization = borrowed / totalSupply
        let utilizationRate = 0;
        try {
          const borrowed = r.getBorrowedAmount();
          const totalSupply = r.getTotalSupply();
          if (totalSupply.gt(0)) {
            utilizationRate = Number(borrowed.div(totalSupply));
          }
        } catch { /* ignore */ }

        // Total supply in USD (deposited × oracle price)
        let totalSupplyUsd = 0;
        try {
          totalSupplyUsd = Number(r.getDepositTvl());
        } catch { /* ignore */ }

        return {
          protocol: "kamino" as const,
          symbol: sym,
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
