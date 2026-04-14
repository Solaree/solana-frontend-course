import { NextRequest, NextResponse } from "next/server";

const JUPITER_SWAP = "https://api.jup.ag/swap/v1/swap";

/**
 * POST /api/swap — proxies Jupiter swap (tx build) requests server-side.
 * Keeps Jupiter calls off the browser to avoid CORS / fetch failures.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.quoteResponse || !body.userPublicKey) {
      return NextResponse.json(
        { error: "quoteResponse and userPublicKey are required" },
        { status: 400 }
      );
    }

    const res = await fetch(JUPITER_SWAP, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quoteResponse: body.quoteResponse,
        userPublicKey: body.userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to build swap transaction" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[swap] Jupiter error:", err);
    return NextResponse.json(
      { error: "Failed to build swap transaction" },
      { status: 502 }
    );
  }
}
