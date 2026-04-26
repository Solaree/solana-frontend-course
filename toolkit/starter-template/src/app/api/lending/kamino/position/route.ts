import { NextRequest, NextResponse } from "next/server";
import { KAMINO_MAIN_MARKET } from "@/lib/lending";

function getRpcEndpoint() {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

/**
 * GET /api/lending/kamino/position?wallet=<base58>&mint=<base58>
 *
 * Returns the wallet's deposited amount (human units) for `mint` on Kamino's
 * main market. 0 if the wallet has no obligation or no deposit in this
 * reserve.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const wallet = url.searchParams.get("wallet");
    const mint = url.searchParams.get("mint");

    if (!wallet || !mint) {
      return NextResponse.json(
        { error: "wallet and mint query parameters are required" },
        { status: 400 }
      );
    }

    // Lazy-import the SDK so it isn't bundled into routes that don't need it.
    const { address, createSolanaRpc } = await import("@solana/kit");
    const { KaminoMarket, VanillaObligation, PROGRAM_ID } = await import(
      "@kamino-finance/klend-sdk"
    );

    const rpc = createSolanaRpc(getRpcEndpoint());
    const market = await KaminoMarket.load(
      rpc as any,
      address(KAMINO_MAIN_MARKET),
      460,
      PROGRAM_ID
    );
    if (!market) throw new Error("Kamino market not found");

    const obligation = await market.getObligationByWallet(
      address(wallet),
      new VanillaObligation(PROGRAM_ID)
    );

    // No obligation = no deposits yet.
    if (!obligation) return NextResponse.json({ deposited: 0 });

    const position = obligation.getDepositByMint(address(mint));
    if (!position) return NextResponse.json({ deposited: 0 });

    // Position.amount is in lamports including accrued interest; mintFactor
    // is 10**decimals as a Decimal. Both are decimal.js values, so divide
    // and convert to a plain number for the wire.
    const human = position.amount.div(position.mintFactor).toNumber();

    return NextResponse.json({ deposited: human });
  } catch (err) {
    console.error("[kamino/position] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
