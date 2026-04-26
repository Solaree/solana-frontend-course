import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { SAVE_MAIN_POOL } from "@/lib/lending";

function getRpcEndpoint() {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

// Save Finance / Solend production program ID. Hard-coded so we don't have
// to import the SDK constants module just for one PublicKey.
const SOLEND_PROGRAM_ID = new PublicKey(
  "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo"
);

/**
 * GET /api/lending/save/position?wallet=<base58>&mint=<base58>
 *
 * Returns the wallet's deposited liquidity amount (in human units) for the
 * given mint in the Save Finance main pool, by reading the on-chain
 * obligation account and converting cToken collateral via the reserve's
 * exchange rate.
 *
 * Response: { deposited: number } — 0 if the wallet has no obligation
 * or no deposit in this reserve.
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

    const walletPk = new PublicKey(wallet);
    const connection = new Connection(getRpcEndpoint(), "confirmed");

    // Solend's obligation address is a deterministic seed-derived account:
    //   PublicKey.createWithSeed(walletPk, pool.address.slice(0,32), programId)
    // (see SolendActionCore in solend-sdk/core/actions.js).
    const seed = SAVE_MAIN_POOL.slice(0, 32);
    const obligationAddress = await PublicKey.createWithSeed(
      walletPk,
      seed,
      SOLEND_PROGRAM_ID
    );

    const obligationInfo = await connection.getAccountInfo(
      obligationAddress,
      "confirmed"
    );

    // No obligation = no deposits yet.
    if (!obligationInfo) {
      return NextResponse.json({ deposited: 0 });
    }

    // Lazy-import the SDK so it isn't bundled into routes that don't need it.
    const { parseObligation, parseReserve } = await import(
      "@solendprotocol/solend-sdk"
    );

    const obligation = parseObligation(obligationAddress, obligationInfo);
    if (!obligation) return NextResponse.json({ deposited: 0 });

    const deposits = obligation.info.deposits;
    if (!deposits.length) return NextResponse.json({ deposited: 0 });

    // For each deposit, the cToken balance lives in obligation; the actual
    // liquidity has to be derived by loading the reserve and applying its
    // exchange rate. We fetch all deposit reserves in one call to keep the
    // RPC round-trip count down.
    const reserveKeys = deposits.map((d) => d.depositReserve);
    const reserveInfos = await connection.getMultipleAccountsInfo(
      reserveKeys,
      "confirmed"
    );

    let depositedLiquidity = 0;
    for (let i = 0; i < deposits.length; i++) {
      const info = reserveInfos[i];
      if (!info) continue;
      const reserve = parseReserve(reserveKeys[i], info);
      if (!reserve) continue;

      // Skip reserves that aren't for the requested mint.
      if (reserve.info.liquidity.mintPubkey.toBase58() !== mint) continue;

      const cTokenAmount = deposits[i].depositedAmount;
      const cTokenSupply = reserve.info.collateral.mintTotalSupply;
      if (cTokenSupply.isZero()) continue;

      // total underlying liquidity = available + borrowed (borrowed is wads → /1e18)
      // exchangeRate = totalLiquidity / cTokenSupply
      // userLiquidity (base units) = cTokenAmount * exchangeRate
      // We do the math in BigInt-via-Number-of-bigint to avoid BN precision
      // pitfalls; values fit comfortably in a JS number once converted to
      // human units (dividing by 10**decimals).
      const available = BigInt(reserve.info.liquidity.availableAmount.toString());
      const borrowedWads = BigInt(
        reserve.info.liquidity.borrowedAmountWads.toString()
      );
      // tsconfig target is ES2017, so BigInt literals (10n) are unavailable —
      // build the 1e18 wad divisor with BigInt() + ** instead.
      const WAD = BigInt(10) ** BigInt(18);
      const borrowed = borrowedWads / WAD;
      const totalLiquidity = available + borrowed;

      const cToken = BigInt(cTokenAmount.toString());
      const cTokenSupplyBI = BigInt(cTokenSupply.toString());

      // Multiply first to preserve precision, then divide.
      const userLiquidityBase = (cToken * totalLiquidity) / cTokenSupplyBI;
      const decimals = reserve.info.liquidity.mintDecimals;
      depositedLiquidity =
        Number(userLiquidityBase) / 10 ** decimals;
      break; // matched the requested mint
    }

    return NextResponse.json({ deposited: depositedLiquidity });
  } catch (err) {
    console.error("[save/position] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
