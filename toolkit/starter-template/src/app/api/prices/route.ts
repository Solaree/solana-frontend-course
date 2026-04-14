import { NextRequest, NextResponse } from "next/server";

const JUPITER_PRICE_V3 = "https://api.jup.ag/price/v3";

/**
 * GET /api/prices?ids=mint1,mint2,...
 *
 * Server-side proxy for Jupiter Price API v3.
 * Returns { [mint]: number } — USD price per token.
 * Avoids CORS issues and keeps all external calls server-side.
 */
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");

  if (!ids) {
    return NextResponse.json(
      { error: "ids query parameter is required (comma-separated mints)" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${JUPITER_PRICE_V3}?ids=${ids}&showExtraInfo=true`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 }, // ISR cache for 30s
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[prices] Jupiter error:", res.status, text);
      return NextResponse.json(
        { error: "Failed to fetch prices" },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Jupiter v3 returns { [mint]: { usdPrice: number, ... } }
    const prices: Record<string, number> = {};

    for (const [mint, info] of Object.entries(data)) {
      const usdPrice = (info as { usdPrice?: number })?.usdPrice;
      if (typeof usdPrice === "number") {
        prices[mint] = usdPrice;
      }
    }

    return NextResponse.json(prices);
  } catch (err) {
    console.error("[prices] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prices from Jupiter" },
      { status: 502 }
    );
  }
}
