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

const AIRDROP_AMOUNT = 1 * LAMPORTS_PER_SOL;
const TIMEOUT_MS = 10000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    promise
      .then((res) => {
        clearTimeout(id);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json(
        { error: "MISSING_ADDRESS" },
        { status: 400 }
      );
    }

    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(address);
    } catch {
      return NextResponse.json(
        { error: "INVALID_ADDRESS" },
        { status: 400 }
      );
    }

    for (const endpoint of ENDPOINTS) {
      const connection = new Connection(endpoint, "confirmed");

      // retry each endpoint 2 times
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const sig = await withTimeout(
            connection.requestAirdrop(pubkey, AIRDROP_AMOUNT),
            TIMEOUT_MS
          );

          // confirm using "finalized" for stronger guarantee
          const latest = await connection.getLatestBlockhash("finalized");

          await withTimeout(
            connection.confirmTransaction(
              {
                signature: sig,
                blockhash: latest.blockhash,
                lastValidBlockHeight: latest.lastValidBlockHeight,
              },
              "finalized"
            ),
            TIMEOUT_MS
          );

          return NextResponse.json({
            signature: sig,
            amount: AIRDROP_AMOUNT / LAMPORTS_PER_SOL,
          });
        } catch (err: any) {
          const msg = err?.message || "";

          // structured handling
          if (msg === "TIMEOUT") {
            continue;
          }

          if (
            msg.includes("429") ||
            msg.toLowerCase().includes("rate") ||
            msg.toLowerCase().includes("faucet")
          ) {
            // try next endpoint
            break;
          }

          // unknown error → don't silently retry forever
          throw err;
        }
      }
    }

    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AIRDROP_FAILED";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
