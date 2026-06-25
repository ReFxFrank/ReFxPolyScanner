"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthDTO, MarketViewDTO } from "@/lib/api-types";
import { StatusBar } from "./StatusBar";
import { MarketTable, type SortKey } from "./MarketTable";
import { MarketDetail } from "./MarketDetail";
import { Select } from "./ui/Controls";

type FlagFilter = "" | "ARB" | "WIDE" | "DIVERGE";

const REFRESH_MS = 10_000;

const FILTERS: { key: FlagFilter; label: string; cls: string }[] = [
  { key: "", label: "All", cls: "" },
  { key: "ARB", label: "ARB", cls: "data-[on=true]:text-flagc-arb data-[on=true]:border-flagc-arb/40" },
  { key: "WIDE", label: "WIDE", cls: "data-[on=true]:text-flagc-wide data-[on=true]:border-flagc-wide/40" },
  { key: "DIVERGE", label: "DIVERGE", cls: "data-[on=true]:text-flagc-diverge data-[on=true]:border-refx-blue-strong" },
];

// Glance-first dashboard: status bar + filterable/sortable table, polling the
// local cache (cheap) every ~10s. A click opens the detail drawer. The
// auto-refresh updates cells in place (stable slug keys) with a calm tick.
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

      {health && health.categories.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-refx border border-flagc-arb/30 bg-flagc-arb/[0.06] px-4 py-2.5 text-[12px] leading-snug">
          <span className="mt-px text-flagc-arb">▲</span>
          <p className="text-refx-muted">
            <span className="font-semibold text-flagc-arb">
              Approximate Polymarket&nbsp;US view
            </span>{" "}
            — showing only{" "}
            <span className="text-refx-text">
              {health.categories.join(", ")}
            </span>{" "}
            markets (the self-certified categories). This filters by{" "}
            <span className="text-refx-text">market type, not verified New York
            tradeability</span> — Polymarket&apos;s public API exposes no
            per-jurisdiction flag, so treat this as a rough proxy, not a
            guarantee any market is tradeable in NY.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            data-on={flag === f.key}
            onClick={() => setFlag(f.key)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
              "border-refx-soft text-refx-meta hover:text-refx-text",
              "data-[on=true]:bg-white/[0.04] data-[on=true]:text-refx-text data-[on=true]:border-refx-blue",
              f.cls,
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm text-refx-meta">
          <label htmlFor="sort" className="eyebrow">sort</label>
          <Select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="volume">24h volume</option>
            <option value="implied">implied %</option>
            <option value="spread">spread</option>
          </Select>
          <label htmlFor="minvol" className="eyebrow">min 24h vol</label>
          <Select
            id="minvol"
            value={minVolume}
            onChange={(e) => setMinVolume(Number(e.target.value))}
          >
            <option value={0}>any</option>
            <option value={1000}>$1k</option>
            <option value={10000}>$10k</option>
            <option value={100000}>$100k</option>
            <option value={1000000}>$1M</option>
          </Select>
        </div>
      </div>

      {!loaded ? (
        <div className="rounded-refx glass px-8 py-12 text-center text-sm text-refx-meta">
          Loading markets…
        </div>
      ) : (
        <MarketTable
          markets={markets}
          onSelect={setSelected}
          selectedSlug={selected}
        />
      )}

      <p className="text-[11px] leading-relaxed text-refx-meta">
        Implied&nbsp;% is the market&apos;s consensus — not an edge signal and not
        a ranking of &ldquo;most likely to win.&rdquo; The only edge signal here is{" "}
        <span className="text-flagc-diverge">DIVERGE</span> (your estimate vs the
        market). <span className="text-flagc-arb">ARB</span> is shown gross, capped
        by depth, before fees.
      </p>

      {selected && (
        <Drawer onClose={() => setSelected(null)}>
          <MarketDetail slug={selected} />
        </Drawer>
      )}
    </div>
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
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-refx-900/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 h-full w-full max-w-xl animate-fade-in overflow-y-auto border-l border-refx-blue bg-refx-shell p-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-refx-meta transition-colors hover:text-refx-text"
          aria-label="Close"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
