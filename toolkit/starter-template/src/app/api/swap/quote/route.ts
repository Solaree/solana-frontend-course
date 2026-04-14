import { NextRequest, NextResponse } from "next/server";

const JUPITER_QUOTE = "https://api.jup.ag/swap/v1/quote";

/**
 * GET /api/swap/quote — proxies Jupiter quote requests server-side.
 * Avoids CORS / browser fetch failures when calling Jupiter directly.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const slippageBps = searchParams.get("slippageBps") ?? "50";

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: "inputMint, outputMint, and amount are required" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });

    const res = await fetch(`${JUPITER_QUOTE}?${params}`, {
      headers: { Accept: "application/json" },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "No routes found for this pair" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[swap/quote] Jupiter error:", err);
    return NextResponse.json(
      { error: "Failed to fetch quote from Jupiter" },
      { status: 502 }
    );
  }
}
