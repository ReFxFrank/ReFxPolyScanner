// ── Poller worker ─────────────────────────────────────────────────────────
// The single process that touches Polymarket. Every POLL_INTERVAL it discovers
// top markets, batch-fetches their books, runs the analysis engine, and writes
// snapshots + history + signals to SQLite. Conservative: one caller, batched
// books, exponential backoff + jitter on 429/errors, a circuit breaker.
//
// Compiled to dist/worker.js (tsconfig.worker.json) and run by systemd as
// `node dist/worker.js`. In dev: `npm run worker:dev`.

import {
  checkBinaryArbitrage,
  fairValueDivergence,
  summarizeBook,
} from "./lib/engine";
import {
  fetchBooks,
  fetchMarkets,
  resolveCategoryTags,
  RateLimitError,
  type CategoryTag,
} from "./lib/polymarket";
import {
  appendProbHistory,
  getEstimatesBySlug,
  getHealth,
  insertSignal,
  pruneProbHistory,
  recordHealth,
  upsertBook,
  upsertMarket,
  type BookRow,
} from "./lib/store";
import type { BookSummary, GammaMarket, OrderBook } from "./lib/types";

const POLL_INTERVAL = num(process.env.POLL_INTERVAL, 25) * 1000;
const MARKET_LIMIT = num(process.env.MARKET_LIMIT, 50);
const DIVERGE_THRESHOLD = num(process.env.DIVERGE_THRESHOLD, 0.05);
const ARB_FEE_BUFFER = num(process.env.ARB_FEE_BUFFER, 0.01);
const WIDE_SPREAD = num(process.env.WIDE_SPREAD, 0.05);
const MAX_BACKOFF_MS = num(process.env.MAX_BACKOFF, 300) * 1000;
const HISTORY_RETENTION_MS =
  num(process.env.HISTORY_RETENTION_DAYS, 14) * 86_400_000;

// Approximate "Polymarket US" view: restrict discovery to these category tag
// slugs. Empty = global (all markets). This filters by market TYPE only — it is
// NOT a verified per-jurisdiction (e.g. New York) tradeability check.
const MARKET_CATEGORIES = (process.env.MARKET_CATEGORIES ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function num(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Track which (slug,kind) signals are currently "active" so we log a signal on
// the rising edge only, instead of spamming one every cycle.
const activeSignals = new Set<string>();

function edge(key: string, active: boolean): boolean {
  const was = activeSignals.has(key);
  if (active) activeSignals.add(key);
  else activeSignals.delete(key);
  return active && !was; // true only on the inactive → active transition
}

interface AnalyzedToken {
  tokenId: string;
  outcome: string;
  summary: BookSummary;
}

/** Run the engine over one market's books and persist snapshots + history. */
function analyzeMarket(
  market: GammaMarket,
  books: Map<string, OrderBook>,
  estimateProb: number | null,
  now: number
): void {
  const analyzed: AnalyzedToken[] = market.tokenIds.map((tokenId, i) => {
    const book = books.get(tokenId) ?? { bids: [], asks: [] };
    return {
      tokenId,
      outcome: market.outcomes[i] ?? `Outcome ${i}`,
      summary: summarizeBook(book),
    };
  });

  upsertMarket({
    slug: market.slug,
    question: market.question,
    condition_id: market.conditionId,
    yes_token_id: market.tokenIds[0] ?? null,
    no_token_id: market.tokenIds[1] ?? null,
    outcomes: JSON.stringify(market.outcomes),
    is_binary: market.isBinary ? 1 : 0,
    neg_risk: market.negRisk ? 1 : 0,
    volume: market.volume,
    volume_24h: market.volume24h,
    updated_at: now,
    categories: market.categories.length
      ? JSON.stringify(market.categories)
      : null,
  });

  for (const a of analyzed) {
    const row: BookRow = {
      token_id: a.tokenId,
      slug: market.slug,
      outcome: a.outcome,
      best_bid: a.summary.bestBid,
      best_ask: a.summary.bestAsk,
      bid_depth: a.summary.bidDepth,
      ask_depth: a.summary.askDepth,
      mid: a.summary.mid,
      spread: a.summary.spread,
      updated_at: now,
    };
    upsertBook(row);
    if (a.summary.mid !== null) {
      appendProbHistory(market.slug, a.tokenId, a.summary.mid, now);
    }
  }

  // ── Flags ────────────────────────────────────────────────────────────
  const yes = analyzed[0]?.summary;
  const no = analyzed[1]?.summary;

  // ARB — binary only; always reported gross, with the depth cap.
  if (market.isBinary && yes && no) {
    const arb = checkBinaryArbitrage(yes, no, ARB_FEE_BUFFER);
    const key = `${market.slug}:ARB`;
    if (edge(key, arb.type !== null)) {
      insertSignal(
        market.slug,
        "ARB",
        `${arb.type} both: gross $${arb.perShare.toFixed(3)}/pair, cap ${arb.capacity.toFixed(0)} (gross, pre-fee)`,
        now
      );
    }
  } else {
    edge(`${market.slug}:ARB`, false);
  }

  // WIDE — wide spread on the primary outcome = thin/uncertain book.
  const primarySpread = yes?.spread;
  {
    const key = `${market.slug}:WIDE`;
    const wide = primarySpread !== null && primarySpread !== undefined && primarySpread >= WIDE_SPREAD;
    if (edge(key, wide)) {
      insertSignal(
        market.slug,
        "WIDE",
        `spread ${(primarySpread! * 100).toFixed(1)}¢ ≥ ${(WIDE_SPREAD * 100).toFixed(0)}¢`,
        now
      );
    }
  }

  // DIVERGE — the ONLY edge signal: your estimate vs the market mid.
  {
    const key = `${market.slug}:DIVERGE`;
    let diverges = false;
    let detail = "";
    if (estimateProb !== null && yes?.mid != null) {
      const d = fairValueDivergence(yes.mid, estimateProb, DIVERGE_THRESHOLD);
      diverges = d.diverges;
      detail = `you ${(estimateProb * 100).toFixed(0)}% vs mkt ${(yes.mid * 100).toFixed(0)}% (${d.direction})`;
    }
    if (edge(key, diverges)) insertSignal(market.slug, "DIVERGE", detail, now);
  }
}

// Resolved once at startup (category slugs -> tag IDs). Empty in global mode.
let categoryTags: CategoryTag[] = [];

async function runCycle(now: number): Promise<number> {
  const markets = await fetchMarkets(MARKET_LIMIT, categoryTags);
  const allTokens = markets.flatMap((m) => m.tokenIds);
  const books = await fetchBooks(allTokens);
  const estimates = getEstimatesBySlug();

  for (const market of markets) {
    const est = estimates.get(market.slug);
    analyzeMarket(market, books, est ? est.your_prob : null, now);
  }
  return markets.length;
}

async function main(): Promise<void> {
  console.log(
    `[poller] starting: interval=${POLL_INTERVAL / 1000}s limit=${MARKET_LIMIT} diverge=${DIVERGE_THRESHOLD} fee=${ARB_FEE_BUFFER}`
  );

  if (MARKET_CATEGORIES.length > 0) {
    categoryTags = await resolveCategoryTags(MARKET_CATEGORIES);
    const resolved = categoryTags.map((c) => c.slug);
    const missing = MARKET_CATEGORIES.filter((s) => !resolved.includes(s));
    console.log(
      `[poller] category filter ACTIVE: ${resolved.join(", ") || "(none resolved)"}` +
        (missing.length ? ` — unresolved: ${missing.join(", ")}` : "")
    );
    if (categoryTags.length === 0) {
      console.warn(
        "[poller] WARNING: no categories resolved; falling back to GLOBAL discovery"
      );
    }
  } else {
    console.log("[poller] category filter off (global discovery)");
  }

  let consecutiveErrors = 0;
  let lastPrune = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const start = Date.now();
    try {
      const count = await runCycle(start);
      const duration = Date.now() - start;
      consecutiveErrors = 0;
      recordHealth({
        last_success: start,
        last_run: start,
        last_duration_ms: duration,
        consecutive_errors: 0,
        last_error: null,
        market_count: count,
      });

      if (start - lastPrune > 3_600_000) {
        const pruned = pruneProbHistory(HISTORY_RETENTION_MS, start);
        if (pruned > 0) console.log(`[poller] pruned ${pruned} old history rows`);
        lastPrune = start;
      }

      console.log(`[poller] ok: ${count} markets in ${duration}ms`);
      await sleep(POLL_INTERVAL);
    } catch (err) {
      consecutiveErrors += 1;
      const isRate = err instanceof RateLimitError;
      const msg = err instanceof Error ? err.message : String(err);
      recordHealth({
        last_success: getHealth()?.last_success ?? null, // preserve prior success ts
        last_run: start,
        last_duration_ms: Date.now() - start,
        consecutive_errors: consecutiveErrors,
        last_error: msg,
        market_count: null,
      });
      // Exponential backoff with jitter; circuit-breaker via the cap.
      const base = isRate ? POLL_INTERVAL * 2 : POLL_INTERVAL;
      const backoff = Math.min(
        base * Math.pow(2, consecutiveErrors - 1),
        MAX_BACKOFF_MS
      );
      const jitter = backoff * 0.25 * Math.random();
      const wait = Math.round(backoff + jitter);
      console.error(
        `[poller] error (#${consecutiveErrors}${isRate ? ", 429" : ""}): ${msg} — backing off ${Math.round(wait / 1000)}s`
      );
      await sleep(wait);
    }
  }
}

main().catch((err) => {
  console.error("[poller] fatal:", err);
  process.exit(1);
});
