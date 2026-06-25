"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthDTO, MarketViewDTO } from "@/lib/api-types";
import { StatusBar } from "./StatusBar";
import { MarketTable, type SortKey } from "./MarketTable";
import { MarketDetail } from "./MarketDetail";

type FlagFilter = "" | "ARB" | "WIDE" | "DIVERGE";

const REFRESH_MS = 10_000;

// The glance-first dashboard: status bar + filterable/sortable table, polling
// the local cache (cheap) every ~10s. A click opens the market detail drawer.
export function Dashboard() {
  const [markets, setMarkets] = useState<MarketViewDTO[]>([]);
  const [health, setHealth] = useState<HealthDTO | null>(null);
  const [flag, setFlag] = useState<FlagFilter>("");
  const [minVolume, setMinVolume] = useState(0);
  const [sort, setSort] = useState<SortKey>("volume");
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ sort });
    if (flag) params.set("flag", flag);
    if (minVolume > 0) params.set("min_volume", String(minVolume));
    const [mRes, hRes] = await Promise.all([
      fetch(`/api/markets?${params}`, { cache: "no-store" }),
      fetch(`/api/health`, { cache: "no-store" }),
    ]);
    if (mRes.ok) setMarkets((await mRes.json()).markets);
    if (hRes.ok) setHealth(await hRes.json());
    setLoaded(true);
  }, [flag, minVolume, sort]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <StatusBar health={health} markets={markets} />

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="All" active={flag === ""} onClick={() => setFlag("")} />
        <FilterChip label="ARB" active={flag === "ARB"} onClick={() => setFlag("ARB")} cls="text-flag-arb" />
        <FilterChip label="WIDE" active={flag === "WIDE"} onClick={() => setFlag("WIDE")} cls="text-flag-wide" />
        <FilterChip label="DIVERGE" active={flag === "DIVERGE"} onClick={() => setFlag("DIVERGE")} cls="text-flag-diverge" />
        <div className="ml-auto flex items-center gap-2 text-sm text-panel-muted">
          <label htmlFor="minvol">min 24h vol</label>
          <select
            id="minvol"
            value={minVolume}
            onChange={(e) => setMinVolume(Number(e.target.value))}
            className="rounded border border-panel-border bg-panel-surface px-2 py-1 text-sm text-white outline-none"
          >
            <option value={0}>any</option>
            <option value={1000}>$1k</option>
            <option value={10000}>$10k</option>
            <option value={100000}>$100k</option>
            <option value={1000000}>$1M</option>
          </select>
        </div>
      </div>

      {!loaded ? (
        <p className="text-sm text-panel-muted">Loading markets…</p>
      ) : (
        <MarketTable
          markets={markets}
          sort={sort}
          onSort={setSort}
          onSelect={setSelected}
        />
      )}

      <p className="text-[11px] leading-snug text-panel-muted">
        Implied % is the market&apos;s consensus, not an edge signal and not a
        ranking of &ldquo;most likely to win.&rdquo; The only edge signal here is
        DIVERGE (your estimate vs the market). ARB is shown gross, capped by
        depth, before fees.
      </p>

      {selected && (
        <Drawer onClose={() => setSelected(null)}>
          <MarketDetail slug={selected} />
        </Drawer>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  cls = "",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  cls?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-white/40 bg-panel-surface text-white"
          : "border-panel-border text-panel-muted hover:text-white"
      } ${cls}`}
    >
      {label}
    </button>
  );
}

function Drawer({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-l border-panel-border bg-panel-bg p-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-panel-muted hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
