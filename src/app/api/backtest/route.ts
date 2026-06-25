import { NextResponse } from "next/server";
import { listEstimates } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/backtest — calibration over resolved, estimated markets.
// Compares YOUR probability and the MARKET price (at log time) against the
// realized outcome via Brier score + hit rate. The market column is the
// honest baseline: edge means beating it, not just being right.
export function GET() {
  const resolved = listEstimates().filter(
    (e) => e.resolved === 1 && (e.outcome === 0 || e.outcome === 1)
  );

  let yourBrierSum = 0;
  let marketBrierSum = 0;
  let marketBrierN = 0;
  let hits = 0;

  const detail = resolved.map((e) => {
    const outcome = e.outcome as 0 | 1;
    const yourBrier = (e.your_prob - outcome) ** 2;
    yourBrierSum += yourBrier;
    const hit = (e.your_prob >= 0.5 ? 1 : 0) === outcome;
    if (hit) hits += 1;

    let marketBrier: number | null = null;
    if (e.market_at_log != null) {
      marketBrier = (e.market_at_log - outcome) ** 2;
      marketBrierSum += marketBrier;
      marketBrierN += 1;
    }
    return {
      id: e.id,
      slug: e.slug,
      yourProb: e.your_prob,
      marketAtLog: e.market_at_log,
      outcome,
      yourBrier,
      marketBrier,
      hit,
    };
  });

  const n = resolved.length;
  return NextResponse.json({
    count: n,
    hitRate: n > 0 ? hits / n : null,
    yourBrier: n > 0 ? yourBrierSum / n : null,
    marketBrier: marketBrierN > 0 ? marketBrierSum / marketBrierN : null,
    // Positive edge = your Brier lower than the market's over the same calls.
    brierEdge:
      n > 0 && marketBrierN > 0
        ? marketBrierSum / marketBrierN - yourBrierSum / n
        : null,
    detail,
  });
}
