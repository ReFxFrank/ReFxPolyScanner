// ── Analysis engine ───────────────────────────────────────────────────────
// Pure functions ported from the `polymarket_scanner.py` reference. No I/O,
// no DB — these are deterministic and covered by test/engine.test.ts.

import type {
  ArbResult,
  BookSummary,
  DivergenceResult,
  OrderBook,
  OrderLevel,
} from "./types";

/**
 * Parse a field that the Gamma API delivers as a JSON-encoded string
 * (e.g. `clobTokenIds`, `outcomes`). Already-parsed arrays pass through.
 * Returns [] on anything unparseable rather than throwing — discovery must
 * not die on one malformed market.
 */
export function parseJsonField<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Coerce CLOB string prices/sizes to numbers, dropping malformed levels. */
export function normalizeLevels(raw: unknown): OrderLevel[] {
  if (!Array.isArray(raw)) return [];
  const out: OrderLevel[] = [];
  for (const lvl of raw) {
    const price = Number((lvl as { price?: unknown })?.price);
    const size = Number((lvl as { size?: unknown })?.size);
    if (Number.isFinite(price) && Number.isFinite(size) && size > 0) {
      out.push({ price, size });
    }
  }
  return out;
}

/**
 * Summarize an order book into top-of-book figures.
 *
 * Best bid = the highest bid price; best ask = the lowest ask price. The book
 * arrives in no guaranteed order, so we scan rather than index [0] — this is
 * the "best-price selection regardless of input order" guarantee.
 *
 * `mid` (== implied probability for a binary outcome) and `spread` are only
 * defined when both sides exist.
 */
export function summarizeBook(book: OrderBook): BookSummary {
  let bestBid: number | null = null;
  let bidDepth = 0;
  for (const lvl of book.bids) {
    if (bestBid === null || lvl.price > bestBid) {
      bestBid = lvl.price;
      bidDepth = lvl.size;
    } else if (lvl.price === bestBid) {
      bidDepth += lvl.size;
    }
  }

  let bestAsk: number | null = null;
  let askDepth = 0;
  for (const lvl of book.asks) {
    if (bestAsk === null || lvl.price < bestAsk) {
      bestAsk = lvl.price;
      askDepth = lvl.size;
    } else if (lvl.price === bestAsk) {
      askDepth += lvl.size;
    }
  }

  const mid =
    bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const spread =
    bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  return { bestBid, bestAsk, mid, spread, bidDepth, askDepth };
}

/**
 * Detect binary arbitrage across a Yes/No pair.
 *
 *  - BUY both: pay yesAsk + noAsk for a position that always pays $1. Profit
 *    when (yesAsk + noAsk) < 1 - feeBuffer. Capped by the smaller ask depth.
 *  - SELL both: receive yesBid + noBid for a combined $1 liability. Profit
 *    when (yesBid + noBid) > 1 + feeBuffer. Capped by the smaller bid depth.
 *
 * The fee buffer makes the trigger conservative; the returned `perShare` is
 * the *gross* edge (so the UI can show "gross" honestly alongside the cap).
 * If both sides trigger, the larger gross edge wins.
 */
export function checkBinaryArbitrage(
  yes: BookSummary,
  no: BookSummary,
  feeBuffer = 0.01
): ArbResult {
  const none: ArbResult = { type: null, perShare: 0, capacity: 0, notional: 0 };

  let buy: ArbResult | null = null;
  if (yes.bestAsk !== null && no.bestAsk !== null) {
    const cost = yes.bestAsk + no.bestAsk;
    if (cost < 1 - feeBuffer) {
      const capacity = Math.min(yes.askDepth, no.askDepth);
      const perShare = 1 - cost;
      buy = { type: "BUY", perShare, capacity, notional: perShare * capacity };
    }
  }

  let sell: ArbResult | null = null;
  if (yes.bestBid !== null && no.bestBid !== null) {
    const proceeds = yes.bestBid + no.bestBid;
    if (proceeds > 1 + feeBuffer) {
      const capacity = Math.min(yes.bidDepth, no.bidDepth);
      const perShare = proceeds - 1;
      sell = { type: "SELL", perShare, capacity, notional: perShare * capacity };
    }
  }

  if (buy && sell) return buy.perShare >= sell.perShare ? buy : sell;
  return buy ?? sell ?? none;
}

/**
 * Compare the market mid (consensus implied probability) to the operator's
 * own estimate. DIVERGE is the *only* edge signal in this tool — it fires
 * only when |yourProb - marketMid| meets the threshold.
 */
export function fairValueDivergence(
  marketMid: number | null,
  yourProb: number,
  threshold = 0.05
): DivergenceResult {
  if (marketMid === null || !Number.isFinite(yourProb)) {
    return { diverges: false, diff: 0, direction: "FLAT" };
  }
  const diff = yourProb - marketMid;
  const diverges = Math.abs(diff) >= threshold;
  const direction = diff > 0 ? "ABOVE" : diff < 0 ? "BELOW" : "FLAT";
  return { diverges, diff, direction };
}
