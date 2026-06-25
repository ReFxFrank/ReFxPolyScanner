import { NextRequest, NextResponse } from "next/server";
import { buildMarketView } from "@/lib/flags";
import {
  getBooksForSlug,
  getEstimatesBySlug,
  getMarket,
  getProbHistory,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/markets/:slug — current books + prob_history series + flags.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const market = getMarket(slug);
  if (!market) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const books = getBooksForSlug(slug);
  const estimate = getEstimatesBySlug().get(slug);
  const view = buildMarketView(market, books, estimate);

  // History grouped by token so the chart can draw a line per outcome.
  const rows = getProbHistory(slug);
  const series = new Map<string, { ts: number; mid: number }[]>();
  for (const r of rows) {
    const list = series.get(r.token_id) ?? [];
    list.push({ ts: r.ts, mid: r.mid });
    series.set(r.token_id, list);
  }

  const labelByToken = new Map(books.map((b) => [b.token_id, b.outcome]));

  return NextResponse.json({
    view,
    books: books.map((b) => ({
      tokenId: b.token_id,
      outcome: b.outcome,
      bestBid: b.best_bid,
      bestAsk: b.best_ask,
      bidDepth: b.bid_depth,
      askDepth: b.ask_depth,
      mid: b.mid,
      spread: b.spread,
    })),
    history: Array.from(series.entries()).map(([tokenId, points]) => ({
      tokenId,
      outcome: labelByToken.get(tokenId) ?? tokenId,
      points,
    })),
  });
}
