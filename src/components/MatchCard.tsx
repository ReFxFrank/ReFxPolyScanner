"use client";

import type { LiveGameDTO, MarketViewDTO } from "@/lib/api-types";
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

// ── Live-score matching ────────────────────────────────────────────────────
const normName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function namesMatch(a: string, b: string): boolean {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 4 && (x.includes(y) || y.includes(x)));
}

/** Find the live game whose two teams match this match's two sides. */
export function findLiveGame(
  match: Match,
  games: LiveGameDTO[]
): LiveGameDTO | null {
  const teams = match.outcomes
    .map((o) => o.label)
    .filter((l) => !/^(tie|draw)$/i.test(l));
  if (teams.length < 2) return null;
  const [a, b] = teams;
  for (const g of games) {
    const ah = namesMatch(a, g.home);
    const aa = namesMatch(a, g.away);
    const bh = namesMatch(b, g.home);
    const ba = namesMatch(b, g.away);
    if ((ah && ba) || (aa && bh)) return g;
  }
  return null;
}

function scoreFor(label: string, live: LiveGameDTO | null): number | null {
  if (!live) return null;
  if (namesMatch(label, live.home)) return live.homeScore;
  if (namesMatch(label, live.away)) return live.awayScore;
  return null;
}

export function MatchCard({
  match,
  live,
  onSelect,
}: {
  match: Match;
  live?: LiveGameDTO | null;
  onSelect: (slug: string) => void;
}) {
  const isLive = live?.state === "in";
  const isFinal = live?.state === "post";

  return (
    <div
      className={`overflow-hidden rounded-refx glass ${isLive ? "shadow-refx-blue" : ""}`}
    >
      {/* header: competition + live status / volume */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
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
        {isLive ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-status-error">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-error" />
            {live?.detail || "LIVE"}
          </span>
        ) : isFinal ? (
          <span className="shrink-0 text-[11px] text-refx-meta">{live?.detail || "Final"}</span>
        ) : (
          <span className="shrink-0 text-[11px] text-refx-meta tabular">
            {usd(match.volume24h)}
          </span>
        )}
      </div>

      {/* outcome rows — each tappable to open that market */}
      <div className="divide-y divide-white/[0.04]">
        {match.outcomes.map((o) => {
          const sc = scoreFor(o.label, live ?? null);
          return (
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
                <div className="flex shrink-0 items-center gap-2">
                  {o.flags.arb && <FlagChip kind="ARB" />}
                  {o.flags.wide && <FlagChip kind="WIDE" />}
                  {o.flags.diverge && <FlagChip kind="DIVERGE" />}
                  {sc != null && (
                    <span
                      className={`min-w-[1.25rem] text-right text-sm font-semibold tabular ${isLive ? "text-status-error" : "text-refx-muted"}`}
                    >
                      {sc}
                    </span>
                  )}
                  <span className="min-w-[3rem] rounded-md bg-white/[0.06] px-2 py-0.5 text-right text-sm font-semibold tabular text-refx-text">
                    {pct(o.prob, 0)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
