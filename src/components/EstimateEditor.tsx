"use client";

import { useState } from "react";
import type { MarketViewDTO } from "@/lib/api-types";
import { pct } from "@/lib/format";
import { GlassPanel } from "./ui/GlassPanel";
import { Button, Eyebrow, Input } from "./ui/Controls";

// Log your YES probability for a market. DIVERGE then surfaces automatically in
// the table when your view differs from the market beyond the threshold. Kept
// tight — this is a quick logging action, not a form.
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
    <GlassPanel className="p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <Eyebrow>Your estimate</Eyebrow>
        <span className="text-xs text-refx-meta tabular">
          market mid <span className="text-refx-muted">{pct(view.impliedProb, 0)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-refx-sm border border-refx-soft bg-refx-900/60 focus-within:border-refx-blue">
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="—"
            className="w-16 bg-transparent px-2.5 py-1.5 text-right tabular text-refx-text outline-none"
          />
          <span className="pr-2.5 text-xs text-refx-meta">% YES</span>
        </div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="note (optional)"
          className="flex-1"
        />
        <Button variant="primary" onClick={save} disabled={busy}>
          {view.estimate ? "Update" : "Log call"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-status-error">{error}</p>}
      <p className="mt-2 text-[11px] leading-snug text-refx-meta">
        Edge is divergence from the market — not the market consensus itself. Only
        log a number you believe is genuinely better-informed.
      </p>
    </GlassPanel>
  );
}
