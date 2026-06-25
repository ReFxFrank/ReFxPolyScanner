// Offline self-test for the analysis engine — the TS counterpart of the
// Python reference's self-test. Synthetic books only; no network, no DB.
// Run: `npm test`  (executes this file directly via tsx + node:test).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkBinaryArbitrage,
  fairValueDivergence,
  normalizeLevels,
  parseJsonField,
  summarizeBook,
} from "../src/lib/engine";
import type { OrderBook } from "../src/lib/types";

test("summarizeBook selects best prices regardless of input order", () => {
  // Bids deliberately unsorted; asks deliberately unsorted.
  const book: OrderBook = {
    bids: [
      { price: 0.4, size: 100 },
      { price: 0.52, size: 200 }, // best bid (highest)
      { price: 0.48, size: 50 },
    ],
    asks: [
      { price: 0.6, size: 80 },
      { price: 0.55, size: 300 }, // best ask (lowest)
      { price: 0.58, size: 40 },
    ],
  };
  const s = summarizeBook(book);
  assert.equal(s.bestBid, 0.52);
  assert.equal(s.bestAsk, 0.55);
  assert.equal(s.bidDepth, 200);
  assert.equal(s.askDepth, 300);
  assert.ok(Math.abs((s.mid ?? 0) - 0.535) < 1e-9);
  assert.ok(Math.abs((s.spread ?? 0) - 0.03) < 1e-9);
});

test("summarizeBook aggregates depth at tied best level", () => {
  const book: OrderBook = {
    bids: [
      { price: 0.5, size: 100 },
      { price: 0.5, size: 150 }, // same best level → depth sums
      { price: 0.3, size: 999 },
    ],
    asks: [{ price: 0.6, size: 10 }],
  };
  const s = summarizeBook(book);
  assert.equal(s.bestBid, 0.5);
  assert.equal(s.bidDepth, 250);
});

test("summarizeBook handles one-sided / empty books", () => {
  const onlyBids = summarizeBook({ bids: [{ price: 0.3, size: 5 }], asks: [] });
  assert.equal(onlyBids.bestAsk, null);
  assert.equal(onlyBids.mid, null);
  assert.equal(onlyBids.spread, null);

  const empty = summarizeBook({ bids: [], asks: [] });
  assert.equal(empty.bestBid, null);
  assert.equal(empty.mid, null);
});

test("checkBinaryArbitrage detects BUY-both (Yes+No < $1)", () => {
  // yesAsk 0.45 + noAsk 0.50 = 0.95 < 1 - 0.01 → buy both for $0.95, pays $1.
  const yes = summarizeBook({ bids: [{ price: 0.44, size: 10 }], asks: [{ price: 0.45, size: 100 }] });
  const no = summarizeBook({ bids: [{ price: 0.49, size: 10 }], asks: [{ price: 0.5, size: 60 }] });
  const arb = checkBinaryArbitrage(yes, no, 0.01);
  assert.equal(arb.type, "BUY");
  assert.ok(Math.abs(arb.perShare - 0.05) < 1e-9);
  assert.equal(arb.capacity, 60); // min(100, 60)
  assert.ok(Math.abs(arb.notional - 0.05 * 60) < 1e-9);
});

test("checkBinaryArbitrage detects SELL-both (Yes+No > $1)", () => {
  // yesBid 0.55 + noBid 0.50 = 1.05 > 1 + 0.01 → sell both, collect $1.05.
  const yes = summarizeBook({ bids: [{ price: 0.55, size: 70 }], asks: [{ price: 0.6, size: 10 }] });
  const no = summarizeBook({ bids: [{ price: 0.5, size: 90 }], asks: [{ price: 0.55, size: 10 }] });
  const arb = checkBinaryArbitrage(yes, no, 0.01);
  assert.equal(arb.type, "SELL");
  assert.ok(Math.abs(arb.perShare - 0.05) < 1e-9);
  assert.equal(arb.capacity, 70); // min(70, 90)
});

test("checkBinaryArbitrage returns none inside the fee buffer", () => {
  // Sum 0.995 < 1 but within the 0.01 fee buffer → no actionable arb.
  const yes = summarizeBook({ bids: [{ price: 0.49, size: 10 }], asks: [{ price: 0.495, size: 100 }] });
  const no = summarizeBook({ bids: [{ price: 0.49, size: 10 }], asks: [{ price: 0.5, size: 100 }] });
  const arb = checkBinaryArbitrage(yes, no, 0.01);
  assert.equal(arb.type, null);
  assert.equal(arb.notional, 0);
});

test("fairValueDivergence respects the threshold and direction", () => {
  // market 0.40, your 0.50 → diff 0.10 >= 0.05 → diverges ABOVE.
  const above = fairValueDivergence(0.4, 0.5, 0.05);
  assert.equal(above.diverges, true);
  assert.equal(above.direction, "ABOVE");
  assert.ok(Math.abs(above.diff - 0.1) < 1e-9);

  // diff 0.03 < 0.05 → no divergence.
  const flat = fairValueDivergence(0.4, 0.43, 0.05);
  assert.equal(flat.diverges, false);

  // your < market → BELOW.
  const below = fairValueDivergence(0.6, 0.5, 0.05);
  assert.equal(below.diverges, true);
  assert.equal(below.direction, "BELOW");

  // null market mid → never diverges.
  assert.equal(fairValueDivergence(null, 0.9, 0.05).diverges, false);
});

test("parseJsonField parses JSON-encoded strings and tolerates junk", () => {
  assert.deepEqual(parseJsonField('["Yes", "No"]'), ["Yes", "No"]);
  assert.deepEqual(parseJsonField('["123", "456"]'), ["123", "456"]);
  assert.deepEqual(parseJsonField(["already", "array"]), ["already", "array"]);
  assert.deepEqual(parseJsonField("not json"), []);
  assert.deepEqual(parseJsonField(undefined), []);
  assert.deepEqual(parseJsonField('{"not":"array"}'), []);
});

test("normalizeLevels coerces strings and drops malformed levels", () => {
  const levels = normalizeLevels([
    { price: "0.52", size: "100" },
    { price: "bad", size: "5" }, // dropped (NaN price)
    { price: "0.4", size: "0" }, // dropped (zero size)
    { price: "0.3", size: "12.5" },
  ]);
  assert.deepEqual(levels, [
    { price: 0.52, size: 100 },
    { price: 0.3, size: 12.5 },
  ]);
});
