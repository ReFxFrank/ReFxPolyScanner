"use client";

import type { MarketViewDTO } from "@/lib/api-types";
import { cents, pct, usd } from "@/lib/format";
import { FlagChip } from "./FlagChip";

export type SortKey = "volume" | "spread" | "implied";

export function MarketTable({
  markets,
  sort,
  onSort,
  onSelect,
}: {
  markets: MarketViewDTO[];
  sort: SortKey;
  onSort: (k: SortKey) => void;
  onSelect: (slug: string) => void;
}) {
  if (markets.length === 0) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel-surface p-8 text-center text-sm text-panel-muted">
        No markets match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-panel-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-panel-surface text-left text-xs uppercase tracking-wide text-panel-muted">
          <tr>
            <Th onClick={() => onSort("implied")} active={sort === "implied"} className="w-24 text-right">
              Implied
            </Th>
            <Th onClick={() => onSort("spread")} active={sort === "spread"} className="w-20 text-right">
              Spread
            </Th>
            <Th onClick={() => onSort("volume")} active={sort === "volume"} className="w-24 text-right">
              24h Vol
            </Th>
            <th className="px-3 py-2 w-40">Flags</th>
            <th className="px-3 py-2">Market</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((m) => (
            <tr
              key={m.slug}
              onClick={() => onSelect(m.slug)}
              className="cursor-pointer border-t border-panel-border hover:bg-panel-surface/60"
            >
              <td className="px-3 py-2 text-right tabular font-medium">
                {pct(m.impliedProb, 1)}
              </td>
              <td className="px-3 py-2 text-right tabular text-panel-muted">
                {cents(m.spread)}
              </td>
              <td className="px-3 py-2 text-right tabular text-panel-muted">
                {usd(m.volume24h)}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {m.flags.arb && m.arb && (
                    <FlagChip
                      kind="ARB"
                      title={`${m.arb.type} both: gross ${cents(m.arb.perShare)}/pair, cap ${usd(m.arb.capacity)} (pre-fee)`}
                    />
                  )}
                  {m.flags.wide && <FlagChip kind="WIDE" title="Wide spread / thin book" />}
                  {m.flags.diverge && m.estimate && (
                    <FlagChip
                      kind="DIVERGE"
                      title={`you ${pct(m.estimate.yourProb, 0)} vs mkt ${pct(m.impliedProb, 0)} (${m.estimate.direction})`}
                    />
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                <span className="line-clamp-1">{m.question}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-3 py-2 hover:text-white ${active ? "text-white" : ""} ${className}`}
    >
      {children}
      {active ? " ▾" : ""}
    </th>
  );
}
