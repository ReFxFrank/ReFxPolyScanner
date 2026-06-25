// ── Sports enrichment (TheSportsDB) ───────────────────────────────────────
// Best-effort team stats for sports markets: pull the team named in the
// question (e.g. "Will Germany win …" → Germany) and show badge, league,
// recent form, and next match. Fetched server-side and cached in SQLite so the
// free third-party API is hit rarely. Never throws — returns { available:false }
// on any miss so the UI just hides the panel.

import { getSportsCache, setSportsCache } from "./store";

const BASE =
  process.env.SPORTSDB_BASE ?? "https://www.thesportsdb.com/api/v1/json/3";
const TTL_OK = 6 * 3600_000; // 6h for a hit
const TTL_MISS = 60 * 60_000; // 1h for a miss (avoid refetch storms)

export interface RecentGame {
  date: string | null;
  event: string;
  score: string | null;
}

export interface SportsInfo {
  available: boolean;
  team?: {
    name: string;
    sport: string | null;
    league: string | null;
    country: string | null;
    badge: string | null;
    blurb: string | null;
  };
  recent?: RecentGame[];
  next?: { date: string | null; event: string } | null;
}

/**
 * Pull the competitor named in a "Will <X> win …" style question. Returns null
 * when the question isn't a team-win market (so we don't show a sports panel on
 * political/other markets).
 */
export function extractTeamName(question: string): string | null {
  const m = question.match(
    /\bwill\s+(.+?)\s+(?:win|beat|defeat|reach|advance|qualify|make)\b/i
  );
  if (!m) return null;
  const name = m[1].trim().replace(/^the\s+/i, "").trim();
  if (name.length < 2 || name.length > 40) return null;
  // Reject obvious non-teams (dates, pure numbers).
  if (/^\d+$/.test(name)) return null;
  return name;
}

async function getJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchTeam(name: string): Promise<SportsInfo> {
  const search = (await getJson(
    `${BASE}/searchteams.php?t=${encodeURIComponent(name)}`
  )) as { teams?: Array<Record<string, string>> | null };
  const team = search.teams?.[0];
  if (!team?.idTeam) return { available: false };

  const info: SportsInfo = {
    available: true,
    team: {
      name: team.strTeam ?? name,
      sport: team.strSport ?? null,
      league: team.strLeague ?? null,
      country: team.strCountry ?? null,
      badge: team.strBadge ?? null,
      blurb: team.strDescriptionEN
        ? team.strDescriptionEN.slice(0, 220).replace(/\s+\S*$/, "") + "…"
        : null,
    },
    recent: [],
    next: null,
  };

  // Recent results + next fixture are nice-to-have; ignore their failures.
  try {
    const last = (await getJson(`${BASE}/eventslast.php?id=${team.idTeam}`)) as {
      results?: Array<Record<string, string>> | null;
    };
    info.recent = (last.results ?? []).slice(0, 5).map((e) => ({
      date: e.dateEvent ?? null,
      event: e.strEvent ?? "",
      score:
        e.intHomeScore != null && e.intAwayScore != null
          ? `${e.intHomeScore}–${e.intAwayScore}`
          : null,
    }));
  } catch {
    /* no recent games */
  }
  try {
    const next = (await getJson(`${BASE}/eventsnext.php?id=${team.idTeam}`)) as {
      events?: Array<Record<string, string>> | null;
    };
    const n = next.events?.[0];
    if (n) info.next = { date: n.dateEvent ?? null, event: n.strEvent ?? "" };
  } catch {
    /* no upcoming game */
  }
  return info;
}

/** Cached team lookup for a market question. Always resolves (never throws). */
export async function getSportsInfo(question: string): Promise<SportsInfo> {
  const name = extractTeamName(question);
  if (!name) return { available: false };

  const key = `team:${name.toLowerCase()}`;
  const now = Date.now();
  const cached = getSportsCache(key);
  if (cached) {
    const fresh = JSON.parse(cached.payload) as SportsInfo;
    const ttl = fresh.available ? TTL_OK : TTL_MISS;
    if (now - cached.ts < ttl) return fresh;
  }

  let info: SportsInfo;
  try {
    info = await fetchTeam(name);
  } catch {
    info = { available: false };
  }
  setSportsCache(key, JSON.stringify(info), now);
  return info;
}
