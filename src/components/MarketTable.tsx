"use client";

import type { MarketViewDTO } from "@/lib/api-types";
import { cents, pct, usd } from "@/lib/format";
import { FlagChip } from "./FlagChip";
import { HeaderCell, Row, SortHeader, TableShell, THead } from "./ui/Table";
import { TickValue } from "./ui/TickValue";

export type SortKey = "volume" | "spread" | "implied";

export function MarketTable({
  markets,
  sort,
  onSort,
  onSelect,
  selectedSlug,
}: {
  markets: MarketViewDTO[];
  sort: SortKey;
  onSort: (k: SortKey) => void;
  onSelect: (slug: string) => void;
  selectedSlug: string | null;
}) {
  if (markets.length === 0) {
    return (
      <div className="rounded-refx glass px-8 py-12 text-center text-sm text-refx-meta">
        No markets match the current filters.
      </div>
    );
  }

  return (
    <TableShell>
      <THead>
        <SortHeader className="w-24 text-right" active={sort === "implied"} onClick={() => onSort("implied")}>
          Implied
        </SortHeader>
        <SortHeader className="w-20 text-right" active={sort === "spread"} onClick={() => onSort("spread")}>
          Spread
        </SortHeader>
        <SortHeader className="w-24 text-right" active={sort === "volume"} onClick={() => onSort("volume")}>
          24h Vol
        </SortHeader>
        <HeaderCell className="w-44">Flags</HeaderCell>
        <HeaderCell>Market</HeaderCell>
      </THead>
      <tbody>
        {markets.map((m) => (
          <Row key={m.slug} selected={m.slug === selectedSlug} onClick={() => onSelect(m.slug)}>
            {/* Implied % = consensus, rendered as neutral bright data (never
                colored/glowed by magnitude). */}
            <td className="px-3 py-2.5 text-right font-medium tabular text-refx-text">
              <TickValue>{pct(m.impliedProb, 1)}</TickValue>
            </td>
            <td className="px-3 py-2.5 text-right tabular text-refx-muted">
              <TickValue>{cents(m.spread)}</TickValue>
            </td>
            <td className="px-3 py-2.5 text-right tabular text-refx-muted">
              {usd(m.volume24h)}
            </td>
            <td className="px-3 py-2.5">
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
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="line-clamp-1 text-refx-muted group-hover:text-refx-text">
                  {m.question}
                </span>
                {m.categories.map((c) => (
                  <span
                    key={c}
                    className="shrink-0 rounded border border-refx-soft px-1 py-0.5 text-[9px] uppercase tracking-wide text-refx-meta"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </td>
          </Row>
        ))}
      </tbody>
    </TableShell>
  );
}
