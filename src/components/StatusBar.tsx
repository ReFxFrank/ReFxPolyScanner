"use client";

import type { HealthDTO, MarketViewDTO } from "@/lib/api-types";
import { ago } from "@/lib/format";

const DOT: Record<HealthDTO["status"], string> = {
  ok: "bg-flag-arb",
  stale: "bg-flag-wide",
  down: "bg-red-500",
};

const LABEL: Record<HealthDTO["status"], string> = {
  ok: "live",
  stale: "stale",
  down: "down",
};

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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-panel-border bg-panel-surface px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${DOT[status]} ${status === "ok" ? "animate-pulse" : ""}`} />
        <span className="font-medium">Poller {LABEL[status]}</span>
      </div>
      <span className="text-panel-muted tabular">
        updated {ago(health?.lastSuccess, health?.now)}
      </span>
      <span className="text-panel-muted tabular">
        {health?.marketCount ?? markets.length} markets
      </span>
      <div className="ml-auto flex items-center gap-3 tabular">
        <Count label="ARB" n={arb} cls="text-flag-arb" />
        <Count label="WIDE" n={wide} cls="text-flag-wide" />
        <Count label="DIVERGE" n={diverge} cls="text-flag-diverge" />
      </div>
      {status !== "ok" && health?.lastError && (
        <span className="w-full truncate text-xs text-red-400">
          last error: {health.lastError}
        </span>
      )}
    </div>
  );
}

function Count({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`font-semibold ${cls}`}>{n}</span>
      <span className="text-[11px] uppercase tracking-wide text-panel-muted">
        {label}
      </span>
    </span>
  );
}
