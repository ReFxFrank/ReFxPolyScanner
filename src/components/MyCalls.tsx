"use client";

import { useCallback, useEffect, useState } from "react";
import type { BacktestDTO, EstimateDTO } from "@/lib/api-types";
import { pct } from "@/lib/format";

// "My Calls": your logged estimates with current/resolved status, plus the
// calibration summary (hit rate + Brier vs the market price at log time).
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

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">My Calls</h1>

      {/* Calibration summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Resolved" value={backtest ? String(backtest.count) : "—"} />
        <Metric
          label="Hit rate"
          value={backtest?.hitRate != null ? pct(backtest.hitRate, 0) : "—"}
        />
        <Metric
          label="Your Brier"
          value={backtest?.yourBrier != null ? backtest.yourBrier.toFixed(3) : "—"}
          hint="lower is better"
        />
        <Metric
          label="Brier edge"
          value={backtest?.brierEdge != null ? backtest.brierEdge.toFixed(3) : "—"}
          hint="vs market @ log; >0 = you beat it"
          good={backtest?.brierEdge != null && backtest.brierEdge > 0}
          bad={backtest?.brierEdge != null && backtest.brierEdge < 0}
        />
      </div>

      {estimates.length === 0 ? (
        <p className="text-sm text-panel-muted">
          No calls logged yet. Open a market on the dashboard and log your YES
          probability.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-panel-border">
          <table className="w-full text-sm">
            <thead className="bg-panel-surface text-left text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2 text-right">Your %</th>
                <th className="px-3 py-2 text-right">Mkt @ log</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.id} className="border-t border-panel-border align-top">
                  <td className="px-3 py-2">
                    <div className="line-clamp-1 max-w-md">{e.slug}</div>
                    {e.note && (
                      <div className="text-xs text-panel-muted">{e.note}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    {pct(e.your_prob, 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-panel-muted">
                    {pct(e.market_at_log, 0)}
                  </td>
                  <td className="px-3 py-2">
                    {e.resolved ? (
                      <span
                        className={
                          e.outcome === 1 ? "text-flag-arb" : "text-red-400"
                        }
                      >
                        {e.outcome === 1 ? "YES" : "NO"}
                      </span>
                    ) : (
                      <span className="text-panel-muted">open</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      {!e.resolved && (
                        <>
                          <button
                            onClick={() => resolve(e.id, 1)}
                            className="rounded bg-flag-arb/15 px-2 py-1 text-xs text-flag-arb hover:bg-flag-arb/25"
                          >
                            YES
                          </button>
                          <button
                            onClick={() => resolve(e.id, 0)}
                            className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-400 hover:bg-red-500/25"
                          >
                            NO
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => remove(e.id)}
                        className="rounded px-2 py-1 text-xs text-panel-muted hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-panel-muted">
        Resolution is captured manually (mark YES/NO when a market settles). The
        backtest scores your calls against the market price you faced at log time
        — beating that baseline is what &ldquo;edge&rdquo; means here.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  good,
  bad,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel-surface p-3">
      <div className="text-xs uppercase tracking-wide text-panel-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-semibold tabular ${
          good ? "text-flag-arb" : bad ? "text-red-400" : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-panel-muted">{hint}</div>}
    </div>
  );
}
