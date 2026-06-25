"use client";

import type { MarketViewDTO } from "@/lib/api-types";
import { cents, pct, usd } from "@/lib/format";
import { FlagChip } from "./FlagChip";

export type SortKey = "volume" | "spread" | "implied";

// Responsive card grid: 1 column on phones, 2 on tablet, 3 on wide desktop.
// Every market shows its full question + big neutral stats, readable at any
// width. Sorting is driven by the dropdown in the Dashboard toolbar.
export function MarketTable({
  markets,
  onSelect,
  selectedSlug,
}: {
  markets: MarketViewDTO[];
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {markets.map((m) => (
        <MarketCard
          key={m.slug}
          m={m}
          selected={m.slug === selectedSlug}
          onSelect={onSelect}
        />
      ))}
    </div>
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
      className={`flex h-full w-full flex-col rounded-refx glass p-3.5 text-left transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99] ${
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

      {/* full question — fully readable, never truncated */}
      <p className="text-[15px] font-medium leading-snug text-refx-text">
        {m.question}
      </p>

      {/* key stats, with labels — implied is the headline, kept neutral */}
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
