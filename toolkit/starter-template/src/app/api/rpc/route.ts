import { NextRequest, NextResponse } from "next/server";

/**
 * RPC Proxy — forwards JSON-RPC requests to the upstream Solana RPC,
 * keeping the API key server-side only.
 *
 * Usage: set NEXT_PUBLIC_RPC_URL=/api/rpc in production,
 * and HELIUS_API_KEY in your server environment (Vercel, .env.local).
 *
 * This prevents exposing your paid RPC key in the browser JS bundle.
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER || "devnet";

// Build the upstream URL based on cluster
function getUpstreamRpc(): string {
  if (!HELIUS_API_KEY) {
    // Fallback to public RPC if no API key
    const fallbacks: Record<string, string> = {
      devnet: "https://api.devnet.solana.com",
      testnet: "https://api.testnet.solana.com",
      "mainnet-beta": "https://api.mainnet-beta.solana.com",
    };
    return fallbacks[CLUSTER] || fallbacks.devnet;
  }
  // Use Helius with appropriate subdomain
  const subdomain = CLUSTER === "mainnet-beta" ? "mainnet" : CLUSTER;
  return `https://${subdomain}.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
}

const UPSTREAM_RPC = getUpstreamRpc();

const ALLOWED_METHODS = new Set([
  "getBalance",
  "getAccountInfo",
  "getLatestBlockhash",
  "getTokenAccountsByOwner",
  "getParsedTokenAccountsByOwner",
  "getSignaturesForAddress",
  "getSignatureStatuses",
  "getTransaction",
  "getMultipleAccounts",
  "sendTransaction",
  "simulateTransaction",
  "confirmTransaction",
  "isBlockhashValid",
  "getSlot",
  "getBlockHeight",
  "getEpochInfo",
  "requestAirdrop",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const method = body?.method;
    if (!method || !ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { error: `Method "${method}" is not allowed through the proxy` },
        { status: 403 }
      );
    }

    const upstream = await fetch(UPSTREAM_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
