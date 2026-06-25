"use client";

import { useCallback, useEffect, useState } from "react";
import type { BacktestDTO, EstimateDTO } from "@/lib/api-types";
import { pct } from "@/lib/format";
import { StatCard } from "./ui/StatCard";
import { StatusPill } from "./ui/StatusPill";
import { Button } from "./ui/Controls";
import { HeaderCell, Row, TableShell, THead } from "./ui/Table";

// "My Calls": your logged estimates with current/resolved status, plus the
// calibration summary (hit rate + Brier vs the market price at log time).
// Presented soberly as data — no celebratory styling.
export function MyCalls() {
  const [estimates, setEstimates] = useState<EstimateDTO[]>([]);
  const [backtest, setBacktest] = useState<BacktestDTO | null>(null);

  const load = useCallback(async () => {
    const [eRes, bRes] = await Promise.all([
      fetch("/api/estimates", { cache: "no-store" }),
      fetch("/api/backtest", { cache: "no-store" }),
    ]);
    if (eRes.ok) setEstimates((await eRes.json()).estimates);
    if (bRes.ok) setBacktest(await bRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: number, outcome: 0 | 1) {
    await fetch(`/api/estimates/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/estimates/${id}`, { method: "DELETE" });
    load();
  }

  const edge = backtest?.brierEdge ?? null;

  return (
    <div className="space-y-5">
      <h1 className="text-base font-semibold text-refx-text2">My Calls</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Resolved" value={backtest ? String(backtest.count) : "—"} />
        <StatCard
          label="Hit rate"
          value={backtest?.hitRate != null ? pct(backtest.hitRate, 0) : "—"}
        />
        <StatCard
          label="Your Brier"
          value={backtest?.yourBrier != null ? backtest.yourBrier.toFixed(3) : "—"}
          hint="lower is better"
        />
        <StatCard
          label="Brier edge"
          value={edge != null ? edge.toFixed(3) : "—"}
          hint="vs market @ log; >0 = you beat it"
          tone={edge == null ? "neutral" : edge > 0 ? "good" : edge < 0 ? "bad" : "neutral"}
        />
      </div>

      {estimates.length === 0 ? (
        <div className="rounded-refx glass px-8 py-12 text-center text-sm text-refx-meta">
          No calls logged yet. Open a market on the dashboard and log your YES
          probability.
        </div>
      ) : (
        <TableShell>
          <THead>
            <HeaderCell>Market</HeaderCell>
            <HeaderCell className="text-right">Your %</HeaderCell>
            <HeaderCell className="text-right">Mkt @ log</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell className="text-right">Actions</HeaderCell>
          </THead>
          <tbody>
            {estimates.map((e) => (
              <Row key={e.id}>
                <td className="px-3 py-2.5 align-top">
                  <div className="line-clamp-1 max-w-md text-refx-muted">{e.slug}</div>
                  {e.note && <div className="text-xs text-refx-meta">{e.note}</div>}
                </td>
                <td className="px-3 py-2.5 text-right align-top tabular text-refx-text">
                  {pct(e.your_prob, 0)}
                </td>
                <td className="px-3 py-2.5 text-right align-top tabular text-refx-muted">
                  {pct(e.market_at_log, 0)}
                </td>
                <td className="px-3 py-2.5 align-top">
                  {e.resolved ? (
                    <StatusPill
                      kind={e.outcome === 1 ? "live" : "error"}
                      label={e.outcome === 1 ? "YES" : "NO"}
                    />
                  ) : (
                    <StatusPill kind="open" />
                  )}
                </td>
                <td className="px-3 py-2.5 text-right align-top">
                  <div className="flex justify-end gap-1.5">
                    {!e.resolved && (
                      <>
                        <button
                          onClick={() => resolve(e.id, 1)}
                          className="rounded-refx-sm border border-status-live/25 bg-status-live/10 px-2 py-1 text-xs text-status-live hover:bg-status-live/20"
                        >
                          YES
                        </button>
                        <button
                          onClick={() => resolve(e.id, 0)}
                          className="rounded-refx-sm border border-status-error/25 bg-status-error/10 px-2 py-1 text-xs text-status-error hover:bg-status-error/20"
                        >
                          NO
                        </button>
                      </>
                    )}
                    <Button variant="ghost" onClick={() => remove(e.id)} className="px-2 py-1 text-xs">
                      ✕
                    </Button>
                  </div>
                </td>
              </Row>
            ))}
          </tbody>
        </TableShell>
      )}
      <p className="text-[11px] leading-relaxed text-refx-meta">
        Resolution is captured manually (mark YES/NO when a market settles). The
        backtest scores your calls against the market price you faced at log time
        — beating that baseline is what &ldquo;edge&rdquo; means here.
      </p>
    </div>
  );
}
