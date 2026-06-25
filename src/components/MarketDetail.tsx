"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketDetailDTO } from "@/lib/api-types";
import { cents, pct, usd } from "@/lib/format";
import { FlagChip } from "./FlagChip";
import { ProbChart } from "./ProbChart";
import { EstimateEditor } from "./EstimateEditor";
import { GlassPanel } from "./ui/GlassPanel";
import { Eyebrow } from "./ui/Controls";
import { useSession } from "./useSession";

// Market detail: full Yes/No book, the binary-arb readout (gross, with depth +
// fee caveats inline and visible), the probability-over-time chart, the editor.
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
  const arb = view.arb;

  return (
    <div className="space-y-4 pr-2">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {view.flags.diverge && <FlagChip kind="DIVERGE" />}
          {view.flags.arb && <FlagChip kind="ARB" />}
          {view.flags.wide && <FlagChip kind="WIDE" />}
          {view.negRisk && (
            <span className="eyebrow rounded border border-refx-soft px-1.5 py-0.5">
              neg-risk
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold leading-tight text-refx-text2">
          {view.question}
        </h2>
        <p className="mt-1.5 text-sm text-refx-muted tabular">
          implied <span className="text-refx-text">{pct(view.impliedProb)}</span>{" "}
          · spread {cents(view.spread)} · 24h vol {usd(view.volume24h)}
        </p>
      </div>

      {/* Order books — compact two-column readout */}
      <div className="grid gap-3 sm:grid-cols-2">
        {books.map((b) => (
          <GlassPanel key={b.tokenId} className="p-3">
            <div className="mb-2 text-sm font-semibold text-refx-text2">
              {b.outcome}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm tabular">
              <Stat label="best bid" value={cents(b.bestBid)} />
              <Stat label="best ask" value={cents(b.bestAsk)} />
              <Stat label="bid depth" value={usd(b.bidDepth)} />
              <Stat label="ask depth" value={usd(b.askDepth)} />
              <Stat label="mid" value={pct(b.mid)} />
              <Stat label="spread" value={cents(b.spread)} />
            </div>
            <div className="mt-2 truncate font-mono text-[10px] text-refx-meta/70">
              {b.tokenId}
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* Arbitrage — always gross, caveats inline (never hidden) */}
      {view.isBinary && (
        <GlassPanel className="p-3" accent={!!arb?.type}>
          <Eyebrow className="mb-1.5">Binary arbitrage</Eyebrow>
          {arb && arb.type ? (
            <p className="text-sm tabular text-refx-muted">
              <span className="font-semibold text-flagc-arb">{arb.type} both legs</span>
              {" · "}gross <span className="font-semibold text-refx-text">{cents(arb.perShare)}</span>/pair
              {" · "}depth cap <span className="font-semibold text-refx-text">{usd(arb.capacity)}</span> pairs
              {" · "}gross notional <span className="font-semibold text-refx-text">{usd(arb.notional)}</span>
            </p>
          ) : (
            <p className="text-sm text-refx-meta">No arbitrage at current book.</p>
          )}
          <p className="mt-1.5 rounded-refx-sm border border-flagc-arb/20 bg-flagc-arb/5 px-2 py-1.5 text-[11px] leading-snug text-refx-muted">
            Gross figures, before fees and slippage; capped by the resting depth
            shown above. Not a guarantee of fillable profit.
          </p>
        </GlassPanel>
      )}

      {/* Probability history */}
      <GlassPanel className="p-3">
        <Eyebrow className="mb-2">Implied probability over time</Eyebrow>
        <ProbChart series={history} />
      </GlassPanel>

      {/* Estimate editor is operator-only. Public visitors see the operator's
          logged call (if any) read-only via the DIVERGE chip + this note. */}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="eyebrow">{label}</span>
      <span className="text-refx-text">{value}</span>
    </div>
  );
}
