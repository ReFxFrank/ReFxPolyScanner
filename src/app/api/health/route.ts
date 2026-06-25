import { NextResponse } from "next/server";
import { getHealth, getMarkets } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_MS = (Number(process.env.POLL_INTERVAL) || 25) * 1000 * 3;

const CATEGORIES = (process.env.MARKET_CATEGORIES ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// GET /api/health — poller status for the status bar. "stale" if the last
// successful poll is older than 3 intervals; "down" if it never succeeded.
export function GET() {
  const h = getHealth();
  const now = Date.now();
  const marketCount = getMarkets().length;

  let status: "ok" | "stale" | "down" = "down";
  if (h?.last_success) {
    status = now - h.last_success <= STALE_MS ? "ok" : "stale";
  }

  return NextResponse.json({
    status,
    lastSuccess: h?.last_success ?? null,
    lastRun: h?.last_run ?? null,
    lastDurationMs: h?.last_duration_ms ?? null,
    consecutiveErrors: h?.consecutive_errors ?? 0,
    lastError: h?.last_error ?? null,
    marketCount,
    // Active category filter (the approximate "Polymarket US" view). Empty
    // array = global mode. Drives the honesty banner in the UI.
    categories: CATEGORIES,
    now,
  });
}
