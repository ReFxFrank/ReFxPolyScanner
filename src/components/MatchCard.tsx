"use client";

import type { MarketViewDTO } from "@/lib/api-types";
import { pct, usd } from "@/lib/format";
import { FlagChip } from "./FlagChip";

export interface MatchOutcome {
  label: string;
  prob: number | null;
  slug: string;
  flags: { arb: boolean; wide: boolean; diverge: boolean };
}
export interface Match {
  ticker: string;
  title: string;
  categories: string[];
  volume24h: number;
  outcomes: MatchOutcome[];
}

// Title looks like "Japan vs. Sweden" / "Astros @ Tigers" — a real fixture.
const VS = /\bvs?\.?\b|\s@\s/i;
const SPLIT = /\s+vs?\.?\s+|\s+@\s+/i;
// Sub-events that are derivative markets, not the head-to-head winner.
const DERIVATIVE_TITLE = /more markets|\bspread\b|\bo\/u\b|over.?under|\btotal\b/i;
// Exclude derivative outcomes (spread / over-under / handicap) — keep moneyline.
const NON_MONEYLINE =
  /\b(spread|o\/u|over|under|total|handicap|moneyline|margin)\b|[+-]\s?\d/i;

function isMoneyline(label: string | null): boolean {
  if (!label) return false;
  return !NON_MONEYLINE.test(label) && !/\d+(\.\d+)?$/.test(label.trim());
}

/** The other team in "A vs B", given one team's label. */
function opponentName(title: string, team: string): string {
  const parts = title.split(SPLIT).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) return "Opponent";
  const t = team.toLowerCase();
  const other = parts.find(
    (p) => !p.toLowerCase().includes(t) && !t.includes(p.toLowerCase())
  );
  return other ?? (parts[0].toLowerCase() === t ? parts[1] : parts[0]);
}

/**
 * Group flat markets into match cards by their Polymarket event. Only events
 * that look like a head-to-head fixture (vs-title) become a match — futures
 * like "World Cup Winner" stay in the flat list. Derivative markets (spread,
 * totals) are dropped; a single moneyline (e.g. baseball "Yankees Yes/No") is
 * expanded into both teams using the event title.
 */
export function buildMatches(markets: MarketViewDTO[]): Match[] {
  const byEvent = new Map<string, MarketViewDTO[]>();
  for (const m of markets) {
    if (!m.eventTicker || !m.eventTitle) continue;
    const list = byEvent.get(m.eventTicker) ?? [];
    list.push(m);
    byEvent.set(m.eventTicker, list);
  }

  const matches: Match[] = [];
  for (const [ticker, group] of byEvent) {
    const title = group[0].eventTitle ?? "";
    if (!VS.test(title) || DERIVATIVE_TITLE.test(title)) continue;

    const ml = group.filter((m) => isMoneyline(m.groupLabel));
    if (ml.length === 0 || ml.length > 4) continue;

    let outcomes: MatchOutcome[];
    if (ml.length === 1) {
      // Single binary moneyline → expand to both sides via the title.
      const m = ml[0];
      const p = m.impliedProb;
      outcomes = [
        { label: m.groupLabel ?? "", prob: p, slug: m.slug, flags: m.flags },
        {
          label: opponentName(title, m.groupLabel ?? ""),
          prob: p == null ? null : 1 - p,
          slug: m.slug,
          flags: { arb: false, wide: false, diverge: false },
        },
      ];
    } else {
      outcomes = ml
        .map((m) => ({
          label: m.groupLabel ?? m.question,
          prob: m.impliedProb,
          slug: m.slug,
          flags: m.flags,
        }))
        .sort((a, b) => (b.prob ?? -1) - (a.prob ?? -1));
    }

    matches.push({
      ticker,
      title,
      categories: Array.from(new Set(group.flatMap((m) => m.categories))),
      volume24h: ml.reduce((s, m) => s + m.volume24h, 0),
      outcomes,
    });
  }
  return matches.sort((a, b) => b.volume24h - a.volume24h);
}

export function MatchCard({
  match,
  onSelect,
}: {
  match: Match;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-refx glass">
      {/* header: competition + volume */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2">
        <div className="flex items-center gap-1.5">
          {match.categories.map((c) => (
            <span
              key={c}
              className="rounded-full border border-refx-soft px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-refx-meta"
            >
              {c}
            </span>
          ))}
          <span className="truncate text-[13px] font-medium text-refx-text2">
            {match.title}
          </span>
        </div>
        <span className="shrink-0 text-[11px] text-refx-meta tabular">
          {usd(match.volume24h)}
        </span>
      </div>

      {/* outcome rows — each tappable to open that market */}
      <div className="divide-y divide-white/[0.04]">
        {match.outcomes.map((o) => (
          <button
            key={o.slug}
            onClick={() => onSelect(o.slug)}
            className="relative block w-full overflow-hidden text-left transition-colors hover:bg-white/[0.025]"
          >
            {/* neutral proportional bar (consensus probability, not a tip) */}
            <div
              className="absolute inset-y-0 left-0 bg-refx-blue/[0.10]"
              style={{ width: `${Math.round((o.prob ?? 0) * 100)}%` }}
            />
            <div className="relative flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="truncate text-sm text-refx-text">{o.label}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {o.flags.arb && <FlagChip kind="ARB" />}
                {o.flags.wide && <FlagChip kind="WIDE" />}
                {o.flags.diverge && <FlagChip kind="DIVERGE" />}
                <span className="min-w-[3rem] rounded-md bg-white/[0.06] px-2 py-0.5 text-right text-sm font-semibold tabular text-refx-text">
                  {pct(o.prob, 0)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
