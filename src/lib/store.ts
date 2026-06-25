// ── Store: typed query helpers over the SQLite schema ─────────────────────
// Used by both the poller (writes) and the API route handlers (reads). Keeps
// SQL in one place so the two halves can't drift.

import { db } from "./db";

export interface MarketRow {
  slug: string;
  question: string;
  condition_id: string | null;
  yes_token_id: string | null;
  no_token_id: string | null;
  outcomes: string | null;
  is_binary: number;
  neg_risk: number;
  volume: number;
  volume_24h: number;
  updated_at: number;
}

export interface BookRow {
  token_id: string;
  slug: string;
  outcome: string;
  best_bid: number | null;
  best_ask: number | null;
  bid_depth: number;
  ask_depth: number;
  mid: number | null;
  spread: number | null;
  updated_at: number;
}

export interface EstimateRow {
  id: number;
  slug: string;
  your_prob: number;
  market_at_log: number | null;
  note: string | null;
  created_at: number;
  resolved: number;
  outcome: number | null;
}

export interface SignalRow {
  id: number;
  slug: string;
  kind: string;
  detail: string;
  ts: number;
}

export interface HealthRow {
  last_success: number | null;
  last_run: number | null;
  last_duration_ms: number | null;
  consecutive_errors: number;
  last_error: string | null;
  market_count: number | null;
}

// ── Writes (poller) ────────────────────────────────────────────────────────

export function upsertMarket(m: MarketRow): void {
  db()
    .prepare(
      `INSERT INTO markets
        (slug, question, condition_id, yes_token_id, no_token_id, outcomes,
         is_binary, neg_risk, volume, volume_24h, updated_at)
       VALUES (@slug, @question, @condition_id, @yes_token_id, @no_token_id,
         @outcomes, @is_binary, @neg_risk, @volume, @volume_24h, @updated_at)
       ON CONFLICT(slug) DO UPDATE SET
         question=@question, condition_id=@condition_id,
         yes_token_id=@yes_token_id, no_token_id=@no_token_id, outcomes=@outcomes,
         is_binary=@is_binary, neg_risk=@neg_risk, volume=@volume,
         volume_24h=@volume_24h, updated_at=@updated_at`
    )
    .run(m);
}

export function upsertBook(b: BookRow): void {
  db()
    .prepare(
      `INSERT INTO books
        (token_id, slug, outcome, best_bid, best_ask, bid_depth, ask_depth,
         mid, spread, updated_at)
       VALUES (@token_id, @slug, @outcome, @best_bid, @best_ask, @bid_depth,
         @ask_depth, @mid, @spread, @updated_at)
       ON CONFLICT(token_id) DO UPDATE SET
         slug=@slug, outcome=@outcome, best_bid=@best_bid, best_ask=@best_ask,
         bid_depth=@bid_depth, ask_depth=@ask_depth, mid=@mid, spread=@spread,
         updated_at=@updated_at`
    )
    .run(b);
}

export function appendProbHistory(
  slug: string,
  tokenId: string,
  mid: number,
  ts: number
): void {
  db()
    .prepare(
      `INSERT INTO prob_history (slug, token_id, mid, ts) VALUES (?, ?, ?, ?)`
    )
    .run(slug, tokenId, mid, ts);
}

export function insertSignal(
  slug: string,
  kind: string,
  detail: string,
  ts: number
): void {
  db()
    .prepare(`INSERT INTO signals (slug, kind, detail, ts) VALUES (?, ?, ?, ?)`)
    .run(slug, kind, detail, ts);
}

export function recordHealth(h: HealthRow): void {
  db()
    .prepare(
      `INSERT INTO poller_health
        (id, last_success, last_run, last_duration_ms, consecutive_errors,
         last_error, market_count)
       VALUES (1, @last_success, @last_run, @last_duration_ms,
         @consecutive_errors, @last_error, @market_count)
       ON CONFLICT(id) DO UPDATE SET
         last_success=@last_success, last_run=@last_run,
         last_duration_ms=@last_duration_ms,
         consecutive_errors=@consecutive_errors, last_error=@last_error,
         market_count=@market_count`
    )
    .run(h);
}

/**
 * Prune prob_history older than `maxAgeMs`. Keeps the file bounded for a
 * long-running personal panel. Returns rows deleted.
 */
export function pruneProbHistory(maxAgeMs: number, now: number): number {
  const cutoff = now - maxAgeMs;
  return db().prepare(`DELETE FROM prob_history WHERE ts < ?`).run(cutoff)
    .changes;
}

// ── Reads (API) ──────────────────────────────────────────────────────────

export function getHealth(): HealthRow | null {
  return (
    (db()
      .prepare(`SELECT * FROM poller_health WHERE id = 1`)
      .get() as HealthRow | undefined) ?? null
  );
}

export function getMarkets(): MarketRow[] {
  return db()
    .prepare(`SELECT * FROM markets ORDER BY volume_24h DESC`)
    .all() as MarketRow[];
}

export function getMarket(slug: string): MarketRow | null {
  return (
    (db().prepare(`SELECT * FROM markets WHERE slug = ?`).get(slug) as
      | MarketRow
      | undefined) ?? null
  );
}

export function getBooksForSlug(slug: string): BookRow[] {
  return db()
    .prepare(`SELECT * FROM books WHERE slug = ?`)
    .all(slug) as BookRow[];
}

export function getAllBooks(): BookRow[] {
  return db().prepare(`SELECT * FROM books`).all() as BookRow[];
}

export function getProbHistory(slug: string, sinceTs?: number): { token_id: string; mid: number; ts: number }[] {
  if (sinceTs) {
    return db()
      .prepare(
        `SELECT token_id, mid, ts FROM prob_history WHERE slug = ? AND ts >= ? ORDER BY ts ASC`
      )
      .all(slug, sinceTs) as { token_id: string; mid: number; ts: number }[];
  }
  return db()
    .prepare(
      `SELECT token_id, mid, ts FROM prob_history WHERE slug = ? ORDER BY ts ASC`
    )
    .all(slug) as { token_id: string; mid: number; ts: number }[];
}

export function getSignals(sinceTs: number, limit = 200): SignalRow[] {
  return db()
    .prepare(
      `SELECT * FROM signals WHERE ts >= ? ORDER BY ts DESC LIMIT ?`
    )
    .all(sinceTs, limit) as SignalRow[];
}

export function getLatestSignalsBySlug(): Map<string, SignalRow[]> {
  // Most recent signal per (slug, kind) within the last 5 minutes — used to
  // badge the live table without replaying the whole log.
  const rows = db()
    .prepare(
      `SELECT * FROM signals WHERE ts >= ? ORDER BY ts DESC`
    )
    .all(Date.now() - 5 * 60_000) as SignalRow[];
  const map = new Map<string, SignalRow[]>();
  for (const r of rows) {
    const list = map.get(r.slug) ?? [];
    if (!list.some((s) => s.kind === r.kind)) list.push(r);
    map.set(r.slug, list);
  }
  return map;
}

// estimates CRUD
export function listEstimates(): EstimateRow[] {
  return db()
    .prepare(`SELECT * FROM estimates ORDER BY created_at DESC`)
    .all() as EstimateRow[];
}

export function getEstimatesBySlug(): Map<string, EstimateRow> {
  // Latest open estimate per slug, used to surface DIVERGE in the table.
  const rows = db()
    .prepare(
      `SELECT * FROM estimates WHERE resolved = 0 ORDER BY created_at DESC`
    )
    .all() as EstimateRow[];
  const map = new Map<string, EstimateRow>();
  for (const r of rows) if (!map.has(r.slug)) map.set(r.slug, r);
  return map;
}

export function createEstimate(
  slug: string,
  yourProb: number,
  marketAtLog: number | null,
  note: string | null,
  createdAt: number
): EstimateRow {
  const info = db()
    .prepare(
      `INSERT INTO estimates (slug, your_prob, market_at_log, note, created_at, resolved, outcome)
       VALUES (?, ?, ?, ?, ?, 0, NULL)`
    )
    .run(slug, yourProb, marketAtLog, note, createdAt);
  return db()
    .prepare(`SELECT * FROM estimates WHERE id = ?`)
    .get(info.lastInsertRowid) as EstimateRow;
}

export function deleteEstimate(id: number): boolean {
  return db().prepare(`DELETE FROM estimates WHERE id = ?`).run(id).changes > 0;
}

export function resolveEstimate(id: number, outcome: number): boolean {
  return (
    db()
      .prepare(`UPDATE estimates SET resolved = 1, outcome = ? WHERE id = ?`)
      .run(outcome, id).changes > 0
  );
}
