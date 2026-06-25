"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookDTO, MarketDetailDTO } from "@/lib/api-types";
import { cents, pct, usd } from "@/lib/format";
import { FlagChip } from "./FlagChip";
import { ProbChart } from "./ProbChart";
import { EstimateEditor } from "./EstimateEditor";
import { SportsPanel } from "./SportsPanel";
import { GlassPanel } from "./ui/GlassPanel";
import { Eyebrow } from "./ui/Controls";
import { useSession } from "./useSession";

// Beginner-first market detail: leads with plain-language "what the market
// thinks" + what it costs to bet either side, then liquidity in human terms,
// the history chart, and (for sports) a team snapshot. The raw order book is
// tucked into an expandable section for power users.
export function MarketDetail({ slug }: { slug: string }) {
  const [data, setData] = useState<MarketDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useSession();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${slug}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }, [slug]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <p className="text-sm text-status-error">Error: {error}</p>;
  if (!data) return <p className="text-sm text-refx-meta">Loading…</p>;

  const { view, books, history } = data;
  const yesBook = books.find((b) => /yes/i.test(b.outcome)) ?? books[0];
  const noBook = books.find((b) => /no/i.test(b.outcome)) ?? books[1];
  const yesCost = priceToBuy(yesBook);
  const noCost = priceToBuy(noBook);
  const arb = view.arb;

  return (
    <div className="space-y-4 pr-1">
      {/* Header */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {view.flags.diverge && <FlagChip kind="DIVERGE" />}
          {view.flags.arb && <FlagChip kind="ARB" />}
          {view.flags.wide && <FlagChip kind="WIDE" />}
        </div>
        <h2 className="text-lg font-semibold leading-tight text-refx-text2">
          {view.question}
        </h2>
      </div>

      {/* What the market thinks — the plain-language headline */}
      <GlassPanel className="p-4">
        <Eyebrow className="mb-1">What the market thinks</Eyebrow>
        <p className="text-sm leading-relaxed text-refx-muted">
          The crowd gives this about a{" "}
          <span className="text-2xl font-semibold text-refx-text tabular">
            {pct(view.impliedProb, 0)}
          </span>{" "}
          chance of happening.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <BetCard side="Yes" verb="happens" cost={yesCost} />
          <BetCard side="No" verb="doesn't" cost={noCost} />
        </div>
        <p className="mt-2.5 text-[11px] leading-snug text-refx-meta">
          Each share pays out <span className="text-refx-muted">$1.00</span> if
          you&apos;re right, $0 if not. Price ≈ the market&apos;s odds — it is the
          consensus, not a tip.
        </p>
      </GlassPanel>

      {/* How easy to trade — liquidity in plain terms */}
      <GlassPanel className="p-3.5">
        <Eyebrow className="mb-1.5">How easy is it to trade?</Eyebrow>
        <p className="text-sm text-refx-muted">
          <span className="text-refx-text">{liquidityLabel(view.spread)}</span>{" "}
          <span className="text-refx-meta">
            (gap between buy &amp; sell {cents(view.spread)})
          </span>
        </p>
        {(yesBook || noBook) && (
          <p className="mt-1 text-[12px] text-refx-meta tabular">
            Roughly {usd(yesBook?.askDepth)} of Yes and {usd(noBook?.askDepth)} of
            No available at the best price right now.
          </p>
        )}
      </GlassPanel>

      {/* Sports team context (only renders for matched sports markets) */}
      <SportsPanel slug={slug} />

      {/* Arbitrage — only when one actually exists (keeps it gross + caveated) */}
      {view.isBinary && arb && arb.type && (
        <GlassPanel className="p-3.5" accent>
          <Eyebrow className="mb-1.5">Free-money check (arbitrage)</Eyebrow>
          <p className="text-sm tabular text-refx-muted">
            Yes + No currently cost {arb.type === "BUY" ? "less" : "more"} than
            $1 — a{" "}
            <span className="font-semibold text-flagc-arb">
              gross {cents(arb.perShare)}/pair
            </span>{" "}
            edge, capped at {usd(arb.capacity)} pairs.
          </p>
          <p className="mt-1.5 rounded-refx-sm border border-flagc-arb/20 bg-flagc-arb/5 px-2 py-1.5 text-[11px] leading-snug text-refx-muted">
            Gross, before fees &amp; slippage and limited by the amounts above —
            not guaranteed profit.
          </p>
        </GlassPanel>
      )}

      {/* History */}
      <GlassPanel className="p-3.5">
        <Eyebrow className="mb-2">Chance over time</Eyebrow>
        <ProbChart series={history} />
      </GlassPanel>

      {/* Power-user order book, collapsed by default */}
      <details className="group rounded-refx glass px-3.5 py-3">
        <summary className="cursor-pointer list-none text-sm text-refx-muted transition-colors hover:text-refx-text">
          <span className="eyebrow">Order book details</span>
          <span className="float-right text-refx-meta group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {books.map((b) => (
            <div key={b.tokenId} className="rounded-refx-sm border border-refx-soft p-2.5">
              <div className="mb-1.5 text-sm font-semibold text-refx-text2">
                {b.outcome}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] tabular">
                <Stat label="best buy" value={cents(b.bestAsk)} />
                <Stat label="best sell" value={cents(b.bestBid)} />
                <Stat label="buy liq." value={usd(b.askDepth)} />
                <Stat label="sell liq." value={usd(b.bidDepth)} />
                <Stat label="implied" value={pct(b.mid)} />
                <Stat label="spread" value={cents(b.spread)} />
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Operator estimate (write = operator only; others see it read-only) */}
      {session?.admin ? (
        <EstimateEditor view={view} onChange={load} />
      ) : (
        view.estimate && (
          <GlassPanel className="p-3">
            <Eyebrow className="mb-1">Operator estimate</Eyebrow>
            <p className="text-sm text-refx-muted tabular">
              operator{" "}
              <span className="text-refx-text">
                {pct(view.estimate.yourProb, 0)}
              </span>{" "}
              vs market {pct(view.impliedProb, 0)} ({view.estimate.direction})
            </p>
          </GlassPanel>
        )
      )}
    </div>
  );
}

/** Price to buy a side = its best ask (what you'd pay), falling back to mid. */
function priceToBuy(b: BookDTO | undefined): number | null {
  if (!b) return null;
  return b.bestAsk ?? b.mid ?? null;
}

function BetCard({
  side,
  verb,
  cost,
}: {
  side: string;
  verb: string;
  cost: number | null;
}) {
  const multiple = cost && cost > 0 ? 1 / cost : null;
  return (
    <div className="rounded-refx-sm border border-refx-soft bg-white/[0.02] p-2.5">
      <div className="text-sm font-semibold text-refx-text2">Bet {side}</div>
      <div className="mt-0.5 text-[12px] text-refx-meta">
        if it {verb}
      </div>
      <div className="mt-2 text-lg font-semibold tabular text-refx-text">
        {cents(cost)}
      </div>
      <div className="text-[11px] text-refx-meta">
        per share{multiple ? ` · pays ${multiple.toFixed(1)}×` : ""}
      </div>
    </div>
  );
}

function liquidityLabel(spread: number | null): string {
  if (spread == null) return "Hard to trade — one-sided book";
  if (spread <= 0.01) return "Very liquid — easy to trade";
  if (spread <= 0.03) return "Reasonably liquid";
  return "Thin — harder to trade, prices less reliable";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="eyebrow">{label}</span>
      <span className="text-refx-text">{value}</span>
    </div>
  );
}
