// ── Polymarket API client ─────────────────────────────────────────────────
// The ONLY module that talks to Polymarket. Both endpoints are public — no
// auth, no API key, no wallet. Strictly read-only by design and by contract.
//
//   Discovery: Gamma   GET  https://gamma-api.polymarket.com/markets
//   Books:     CLOB     POST https://clob.polymarket.com/books   (batch)
//
// All fetches go through a small helper that surfaces HTTP 429 distinctly so
// the poller can back off the whole loop.

import { normalizeLevels, parseJsonField } from "./engine";
import type { GammaMarket, OrderBook } from "./types";

const GAMMA_BASE = process.env.GAMMA_BASE ?? "https://gamma-api.polymarket.com";
const CLOB_BASE = process.env.CLOB_BASE ?? "https://clob.polymarket.com";

/** Thrown on HTTP 429 so the poller can distinguish rate limiting from errors. */
export class RateLimitError extends Error {
  constructor(public readonly url: string) {
    super(`Rate limited (429): ${url}`);
    this.name = "RateLimitError";
  }
}

interface FetchOpts {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

async function apiFetch(url: string, opts: FetchOpts = {}): Promise<unknown> {
  const { method = "GET", body, timeoutMs = 15000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (res.status === 429) throw new RateLimitError(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Discover the top `limit` active markets ordered by 24h volume. Defensively
 * parses the JSON-encoded `clobTokenIds` / `outcomes` string fields and keeps
 * only markets that actually have an order book.
 */
export async function fetchMarkets(limit: number): Promise<GammaMarket[]> {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    order: "volume24hr",
    ascending: "false",
    limit: String(limit),
  });
  const raw = await apiFetch(`${GAMMA_BASE}/markets?${params.toString()}`);
  if (!Array.isArray(raw)) return [];

  const markets: GammaMarket[] = [];
  for (const m of raw as Array<Record<string, unknown>>) {
    const slug = typeof m.slug === "string" ? m.slug : null;
    const question = typeof m.question === "string" ? m.question : null;
    if (!slug || !question) continue;

    const tokenIds = parseJsonField<string>(m.clobTokenIds).filter(
      (t) => typeof t === "string" && t.length > 0
    );
    const outcomes = parseJsonField<string>(m.outcomes);
    if (tokenIds.length === 0) continue; // no book → nothing to analyze

    markets.push({
      slug,
      question,
      conditionId: typeof m.conditionId === "string" ? m.conditionId : null,
      tokenIds,
      outcomes,
      isBinary: tokenIds.length === 2,
      negRisk: m.negRisk === true,
      volume: Number(m.volume) || 0,
      volume24h: Number(m.volume24hr) || 0,
    });
  }
  return markets;
}

/**
 * Batch-fetch order books for many tokens in as few calls as possible using
 * the CLOB `/books` endpoint (bare array payload). Returns a map of
 * token_id → normalized OrderBook. Chunks large requests to keep payloads sane.
 */
export async function fetchBooks(
  tokenIds: string[],
  chunkSize = 100
): Promise<Map<string, OrderBook>> {
  const out = new Map<string, OrderBook>();
  for (let i = 0; i < tokenIds.length; i += chunkSize) {
    const chunk = tokenIds.slice(i, i + chunkSize);
    const payload = chunk.map((id) => ({ token_id: id }));
    const raw = await apiFetch(`${CLOB_BASE}/books`, {
      method: "POST",
      body: payload,
    });
    if (!Array.isArray(raw)) continue;
    for (const entry of raw as Array<Record<string, unknown>>) {
      const id = typeof entry.asset_id === "string" ? entry.asset_id : null;
      if (!id) continue;
      out.set(id, {
        bids: normalizeLevels(entry.bids),
        asks: normalizeLevels(entry.asks),
      });
    }
  }
  return out;
}
