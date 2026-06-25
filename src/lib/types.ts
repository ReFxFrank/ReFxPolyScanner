// Shared domain types for the analysis engine and the rest of the app.

/** A single resting order level as returned by the CLOB book endpoint. */
export interface OrderLevel {
  price: number;
  size: number;
}

/** A normalized order book (prices/sizes already parsed to numbers). */
export interface OrderBook {
  bids: OrderLevel[];
  asks: OrderLevel[];
}

/** Top-of-book summary for one outcome token = the engine's core read. */
export interface BookSummary {
  bestBid: number | null;
  bestAsk: number | null;
  /** Mid price == implied probability for a binary outcome. */
  mid: number | null;
  spread: number | null;
  /** Resting size at the best bid / best ask. */
  bidDepth: number;
  askDepth: number;
}

/** Result of binary arbitrage detection across a Yes/No pair. */
export interface ArbResult {
  /** BUY = buy both legs < $1; SELL = sell both legs > $1; null = none. */
  type: "BUY" | "SELL" | null;
  /** Gross edge per pair in dollars (before fees; fee buffer already applied to the trigger). */
  perShare: number;
  /** How many pairs the resting depth supports (the depth cap). */
  capacity: number;
  /** perShare * capacity — gross notional edge, capped by depth. */
  notional: number;
}

/** Result of comparing the market mid to the operator's own estimate. */
export interface DivergenceResult {
  diverges: boolean;
  /** yourProb - marketMid. Positive = you think more likely than market. */
  diff: number;
  direction: "ABOVE" | "BELOW" | "FLAT";
}

/** A discovered market from the Gamma API, defensively parsed. */
export interface GammaMarket {
  slug: string;
  question: string;
  conditionId: string | null;
  /** Parsed from the JSON-encoded `clobTokenIds` string. */
  tokenIds: string[];
  /** Parsed from the JSON-encoded `outcomes` string. */
  outcomes: string[];
  isBinary: boolean;
  negRisk: boolean;
  volume: number;
  volume24h: number;
}
