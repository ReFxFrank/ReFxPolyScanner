"use client";

import type { HealthDTO, MarketViewDTO } from "@/lib/api-types";
import { ago } from "@/lib/format";
import { GlassPanel } from "./ui/GlassPanel";
import { StatusPill } from "./ui/StatusPill";

const KIND = { ok: "live", stale: "stale", down: "error" } as const;

export function StatusBar({
  health,
  markets,
}: {
  health: HealthDTO | null;
  markets: MarketViewDTO[];
}) {
  const arb = markets.filter((m) => m.flags.arb).length;
  const wide = markets.filter((m) => m.flags.wide).length;
  const diverge = markets.filter((m) => m.flags.diverge).length;
  const status = health?.status ?? "down";

  return (
    <GlassPanel beam className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-3">
      <StatusPill kind={KIND[status]} />
      <span className="text-sm text-refx-muted tabular">
        updated <span className="text-refx-text">{ago(health?.lastSuccess, health?.now)}</span>
      </span>
      <span className="text-sm text-refx-muted tabular">
        <span className="text-refx-text">{health?.marketCount ?? markets.length}</span> markets
      </span>

      <div className="ml-auto flex items-center gap-2.5 tabular">
        <Counter label="ARB" n={arb} cls="text-flagc-arb border-flagc-arb/30 bg-flagc-arb/8" />
        <Counter label="WIDE" n={wide} cls="text-flagc-wide border-flagc-wide/25 bg-flagc-wide/8" />
        <Counter label="DIVERGE" n={diverge} cls="text-flagc-diverge border-refx-blue-strong bg-refx-blue/10" />
      </div>

      {status !== "ok" && health?.lastError && (
        <span className="w-full truncate border-t border-refx-faint pt-2 text-xs text-status-error">
          last error: {health.lastError}
        </span>
      )}
    </GlassPanel>
  );
}

function Counter({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${cls}`}>
      <span className="text-sm font-semibold">{n}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </span>
    </span>
  );
}
