"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketDetailDTO } from "@/lib/api-types";
import { cents, pct, usd } from "@/lib/format";
import { FlagChip } from "./FlagChip";
import { ProbChart } from "./ProbChart";
import { EstimateEditor } from "./EstimateEditor";

// Market detail: full Yes/No book, the binary-arb readout (gross, with depth +
// fee caveats inline), the probability-over-time chart, and the estimate editor.
export function MarketDetail({ slug }: { slug: string }) {
  const [data, setData] = useState<MarketDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <p className="text-sm text-red-400">Error: {error}</p>;
  if (!data) return <p className="text-sm text-panel-muted">Loading…</p>;

  const { view, books, history } = data;
  const arb = view.arb;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {view.flags.arb && <FlagChip kind="ARB" />}
          {view.flags.wide && <FlagChip kind="WIDE" />}
          {view.flags.diverge && <FlagChip kind="DIVERGE" />}
          {view.negRisk && (
            <span className="rounded border border-panel-border px-1.5 py-0.5 text-[10px] uppercase text-panel-muted">
              neg-risk
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold leading-tight">{view.question}</h2>
        <p className="mt-1 text-sm text-panel-muted tabular">
          implied {pct(view.impliedProb)} · spread {cents(view.spread)} · 24h
          vol {usd(view.volume24h)}
        </p>
      </div>

      {/* Order books */}
      <div className="grid gap-3 sm:grid-cols-2">
        {books.map((b) => (
          <div
            key={b.tokenId}
            className="rounded-lg border border-panel-border bg-panel-surface p-3"
          >
            <div className="mb-2 text-sm font-semibold">{b.outcome}</div>
            <div className="grid grid-cols-2 gap-2 text-sm tabular">
              <Stat label="best bid" value={cents(b.bestBid)} />
              <Stat label="best ask" value={cents(b.bestAsk)} />
              <Stat label="bid depth" value={usd(b.bidDepth)} />
              <Stat label="ask depth" value={usd(b.askDepth)} />
              <Stat label="mid" value={pct(b.mid)} />
              <Stat label="spread" value={cents(b.spread)} />
            </div>
          </div>
        ))}
      </div>

      {/* Arbitrage readout — always gross, with caveats */}
      {view.isBinary && (
        <div className="rounded-lg border border-panel-border bg-panel-surface p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-panel-muted">
            Binary arbitrage
          </div>
          {arb && arb.type ? (
            <p className="text-sm tabular">
              <span className="font-semibold text-flag-arb">
                {arb.type} both legs
              </span>{" "}
              · gross{" "}
              <span className="font-semibold">{cents(arb.perShare)}</span>/pair ·
              depth cap{" "}
              <span className="font-semibold">{usd(arb.capacity)}</span> pairs ·
              gross notional{" "}
              <span className="font-semibold">{usd(arb.notional)}</span>
            </p>
          ) : (
            <p className="text-sm text-panel-muted">No arbitrage at current book.</p>
          )}
          <p className="mt-1 text-[11px] text-panel-muted">
            Gross figures, before fees and slippage; capped by resting depth shown
            above. Not a guarantee of fillable profit.
          </p>
        </div>
      )}

      {/* Probability history */}
      <div className="rounded-lg border border-panel-border bg-panel-surface p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-panel-muted">
          Implied probability over time
        </div>
        <ProbChart series={history} />
      </div>

      <EstimateEditor view={view} onChange={load} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-panel-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
