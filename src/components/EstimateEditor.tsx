"use client";

import { useState } from "react";
import type { MarketViewDTO } from "@/lib/api-types";
import { pct } from "@/lib/format";

// Log your YES probability for a market. DIVERGE then surfaces automatically
// in the table when your view differs from the market beyond the threshold.
export function EstimateEditor({
  view,
  onChange,
}: {
  view: MarketViewDTO;
  onChange: () => void;
}) {
  const [value, setValue] = useState(
    view.estimate ? Math.round(view.estimate.yourProb * 100).toString() : ""
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("Enter 0–100");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: view.slug, yourProb: n / 100, note }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      setNote("");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-panel-border bg-panel-bg p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-panel-muted">
          Your estimate
        </span>
        <span className="text-xs text-panel-muted">
          market mid {pct(view.impliedProb, 0)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded border border-panel-border bg-panel-surface">
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="—"
            className="w-16 bg-transparent px-2 py-1.5 text-right tabular outline-none"
          />
          <span className="pr-2 text-panel-muted">% YES</span>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="note (optional)"
          className="flex-1 rounded border border-panel-border bg-panel-surface px-2 py-1.5 text-sm outline-none"
        />
        <button
          onClick={save}
          disabled={busy}
          className="rounded bg-flag-diverge/20 px-3 py-1.5 text-sm font-medium text-flag-diverge hover:bg-flag-diverge/30 disabled:opacity-50"
        >
          {view.estimate ? "Update" : "Log call"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <p className="mt-2 text-[11px] leading-snug text-panel-muted">
        Edge is divergence from the market — not the market consensus itself.
        Only log a number you believe is genuinely better-informed.
      </p>
    </div>
  );
}
