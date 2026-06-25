// Plain response shapes shared by client components. No server imports here
// (so this never drags better-sqlite3 into the browser bundle).

export interface MarketViewDTO {
  slug: string;
  question: string;
  isBinary: boolean;
  negRisk: boolean;
  volume: number;
  volume24h: number;
  updatedAt: number;
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

export interface HealthDTO {
  status: "ok" | "stale" | "down";
  lastSuccess: number | null;
  lastRun: number | null;
  lastDurationMs: number | null;
  consecutiveErrors: number;
  lastError: string | null;
  marketCount: number;
  now: number;
}

export interface BookDTO {
  tokenId: string;
  outcome: string;
  bestBid: number | null;
  bestAsk: number | null;
  bidDepth: number;
  askDepth: number;
  mid: number | null;
  spread: number | null;
}

export interface HistorySeriesDTO {
  tokenId: string;
  outcome: string;
  points: { ts: number; mid: number }[];
}

export interface MarketDetailDTO {
  view: MarketViewDTO;
  books: BookDTO[];
  history: HistorySeriesDTO[];
}

export interface EstimateDTO {
  id: number;
  slug: string;
  your_prob: number;
  market_at_log: number | null;
  note: string | null;
  created_at: number;
  resolved: number;
  outcome: number | null;
}

export interface SignalDTO {
  id: number;
  slug: string;
  kind: string;
  detail: string;
  ts: number;
}

export interface BacktestDTO {
  count: number;
  hitRate: number | null;
  yourBrier: number | null;
  marketBrier: number | null;
  brierEdge: number | null;
  detail: {
    id: number;
    slug: string;
    yourProb: number;
    marketAtLog: number | null;
    outcome: 0 | 1;
    yourBrier: number;
    marketBrier: number | null;
    hit: boolean;
  }[];
}
