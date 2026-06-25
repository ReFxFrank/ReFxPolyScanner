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
    <>
      {/* Mobile / narrow: readable cards (full question, big neutral stats). */}
      <div className="space-y-2.5 md:hidden">
        {markets.map((m) => (
          <MarketCard
            key={m.slug}
            m={m}
            selected={m.slug === selectedSlug}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Desktop / wide: dense sortable table. */}
      <div className="hidden md:block">
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
                    <MarketFlags m={m} />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="line-clamp-1 text-refx-muted group-hover:text-refx-text">
                      {m.question}
                    </span>
                    {m.categories.map((c) => (
                      <CategoryTag key={c} c={c} />
                    ))}
                  </div>
                </td>
              </Row>
            ))}
          </tbody>
        </TableShell>
      </div>
    </>
  );
}

function MarketCard({
  m,
  selected,
  onSelect,
}: {
  m: MarketViewDTO;
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(m.slug)}
      className={`block w-full rounded-refx glass p-3.5 text-left transition-transform duration-150 active:scale-[0.99] ${
        selected ? "border-refx-blue-strong shadow-refx-blue" : ""
      }`}
    >
      {/* chips: category + flags */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {m.categories.map((c) => (
          <CategoryTag key={c} c={c} />
        ))}
        <MarketFlags m={m} />
      </div>

      {/* full question — the most important thing, now fully readable */}
      <p className="text-[15px] font-medium leading-snug text-refx-text">
        {m.question}
      </p>

      {/* key stats, with labels */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-2.5">
        <CardStat label="implied" value={pct(m.impliedProb, 1)} emphasize />
        <CardStat label="spread" value={cents(m.spread)} />
        <CardStat label="24h vol" value={usd(m.volume24h)} />
      </div>
    </button>
  );
}

function CardStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <div
        className={`tabular ${emphasize ? "text-lg font-semibold text-refx-text" : "text-sm text-refx-muted"}`}
      >
        {value}
      </div>
      <div className="eyebrow mt-0.5">{label}</div>
    </div>
  );
}

function MarketFlags({ m }: { m: MarketViewDTO }) {
  return (
    <>
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
    </>
  );
}

function CategoryTag({ c }: { c: string }) {
  return (
    <span className="shrink-0 rounded-full border border-refx-soft px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-refx-meta">
      {c}
    </span>
  );
}
