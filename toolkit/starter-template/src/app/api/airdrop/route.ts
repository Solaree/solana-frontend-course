import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * Server-side airdrop endpoint that tries multiple RPC providers.
 * Each provider has its own rate limit, so rotating gives more attempts.
 */

const HELIUS_KEY = process.env.HELIUS_API_KEY;

const ENDPOINTS = [
  // Helius devnet (if key available — separate rate limit)
  ...(HELIUS_KEY
    ? [`https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}`]
    : []),
  // Public devnet endpoints (each has its own rate limit)
  "https://api.devnet.solana.com",
];

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(address);
    } catch {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    // Try each endpoint until one succeeds
    for (const endpoint of ENDPOINTS) {
      try {
        const connection = new Connection(endpoint, "confirmed");

        const sig = await connection.requestAirdrop(
          pubkey,
          1 * LAMPORTS_PER_SOL
        );

        // Confirm using the same connection that issued the airdrop
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");

        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        return NextResponse.json({ signature: sig });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        // If rate limited or internal error, try next endpoint
        if (
          msg.includes("429") ||
          msg.includes("Internal error") ||
          msg.includes("union of") ||
          msg.includes("faucet")
        ) {
          continue;
        }
        // Other errors (invalid address etc) — don't retry
        throw err;
      }
    }

    // All endpoints exhausted
    return NextResponse.json(
      { error: "All faucets rate-limited. Try again in a few minutes or use Faucet (https://faucet.solana.com)" },
      { status: 429 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Airdrop failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
