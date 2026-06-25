// ── Display flags ─────────────────────────────────────────────────────────
// Computes the table/detail flags (ARB / WIDE / DIVERGE) for the API from the
// latest stored snapshots, reusing the same engine as the poller. Keeping this
// pure and shared means the live table and the signals log can't disagree.

import { checkBinaryArbitrage, fairValueDivergence } from "./engine";
import type { BookRow, EstimateRow, MarketRow } from "./store";
import type { BookSummary } from "./types";

const WIDE_SPREAD = num(process.env.WIDE_SPREAD, 0.05);
const DIVERGE_THRESHOLD = num(process.env.DIVERGE_THRESHOLD, 0.05);
const ARB_FEE_BUFFER = num(process.env.ARB_FEE_BUFFER, 0.01);

function num(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

/** Parse the stored categories JSON column into a slug array. */
function parseCategories(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function toSummary(b: BookRow | undefined): BookSummary | null {
  if (!b) return null;
  return {
    bestBid: b.best_bid,
    bestAsk: b.best_ask,
    mid: b.mid,
    spread: b.spread,
    bidDepth: b.bid_depth,
    askDepth: b.ask_depth,
  };
}

export interface MarketView {
  slug: string;
  question: string;
  isBinary: boolean;
  negRisk: boolean;
  volume: number;
  volume24h: number;
  updatedAt: number;
  /** Category slugs this market matched (empty in global mode). */
  categories: string[];
  /** Polymarket event grouping for the Matches view. */
  eventTicker: string | null;
  eventTitle: string | null;
  groupLabel: string | null;
  /** YES implied probability (the market mid), or null if no book. */
  impliedProb: number | null;
  spread: number | null;
  flags: { arb: boolean; wide: boolean; diverge: boolean };
  arb: {
    type: "BUY" | "SELL" | null;
    perShare: number;
    capacity: number;
    notional: number;
  } | null;
  estimate: { yourProb: number; diff: number; direction: string } | null;
}

/**
 * Build the view-model for one market from its stored book rows and an
 * optional open estimate. `books` are the rows for this slug (any order).
 */
export function buildMarketView(
  market: MarketRow,
  books: BookRow[],
  estimate: EstimateRow | undefined
): MarketView {
  const byToken = new Map(books.map((b) => [b.token_id, b]));
  const yesRow = market.yes_token_id ? byToken.get(market.yes_token_id) : undefined;
  const noRow = market.no_token_id ? byToken.get(market.no_token_id) : undefined;
  const yes = toSummary(yesRow);
  const no = toSummary(noRow);

  const impliedProb = yes?.mid ?? null;
  const spread = yes?.spread ?? null;

  let arb: MarketView["arb"] = null;
  if (market.is_binary && yes && no) {
    const r = checkBinaryArbitrage(yes, no, ARB_FEE_BUFFER);
    arb = {
      type: r.type,
      perShare: r.perShare,
      capacity: r.capacity,
      notional: r.notional,
    };
  }

  let estView: MarketView["estimate"] = null;
  let diverge = false;
  if (estimate && impliedProb !== null) {
    const d = fairValueDivergence(impliedProb, estimate.your_prob, DIVERGE_THRESHOLD);
    diverge = d.diverges;
    estView = { yourProb: estimate.your_prob, diff: d.diff, direction: d.direction };
  }

  const wide = spread !== null && spread >= WIDE_SPREAD;

  return {
    slug: market.slug,
    question: market.question,
    isBinary: market.is_binary === 1,
    negRisk: market.neg_risk === 1,
    volume: market.volume,
    volume24h: market.volume_24h,
    updatedAt: market.updated_at,
    categories: parseCategories(market.categories),
    eventTicker: market.event_ticker,
    eventTitle: market.event_title,
    groupLabel: market.group_item_title,
    impliedProb,
    spread,
    flags: { arb: arb?.type !== null && arb !== null, wide, diverge },
    arb,
    estimate: estView,
  };
}
