// ── Sports enrichment (TheSportsDB) ───────────────────────────────────────
// Best-effort team context for sports markets: the team named in the question,
// its upcoming match (head-to-head with the opponent), recent results, and the
// group/league standings. Fetched server-side, cached in SQLite so the free
// third-party API is hit rarely. Never throws — returns { available:false } on
// any miss so the UI just hides the panel.

import { getSportsCache, setSportsCache } from "./store";
import { apiFootballEnabled, getTopScorers, type TopScorers } from "./apifootball";

const BASE =
  process.env.SPORTSDB_BASE ?? "https://www.thesportsdb.com/api/v1/json/3";
const TTL_OK = 6 * 3600_000; // 6h for a hit
const TTL_MISS = 60 * 60_000; // 1h for a miss

export interface RecentGame {
  date: string | null;
  event: string;
  score: string | null;
}
export interface SideTeam {
  name: string;
  badge: string | null;
  /** Recent form string like "WWDLW" (most recent last), if known. */
  form: string | null;
}
export interface MatchInfo {
  date: string | null;
  venue: string | null;
  league: string | null;
  home: SideTeam;
  away: SideTeam;
}
export interface StandingRow {
  rank: number | null;
  team: string;
  badge: string | null;
  played: number | null;
  win: number | null;
  draw: number | null;
  loss: number | null;
  gd: number | null;
  points: number | null;
  /** Recent form string like "WWDLW" (most recent last), if known. */
  form: string | null;
  /** Group label (e.g. "E") when the table spans multiple groups. */
  group: string | null;
  /** True for the team(s) this market is about. */
  highlight: boolean;
}
export interface Standings {
  league: string | null;
  season: string | null;
  group: string | null;
  rows: StandingRow[];
}
export interface H2HGame {
  date: string | null;
  event: string;
  score: string | null;
}
export interface H2HRecord {
  teamA: string;
  teamB: string;
  /** From teamA's perspective. */
  record: { w: number; d: number; l: number };
  games: H2HGame[];
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
  match?: MatchInfo | null;
  h2h?: H2HRecord | null;
  recent?: RecentGame[];
  standings?: Standings | null;
  topScorers?: TopScorers | null;
}

/** Build a head-to-head record for two teams from a pool of past events. */
function summarizeH2H(
  teamId: string,
  teamName: string,
  oppId: string,
  oppName: string,
  events: Row[]
): H2HRecord | null {
  const seen = new Set<string>();
  const games: H2HGame[] = [];
  let w = 0;
  let d = 0;
  let l = 0;
  for (const e of events) {
    const ids = [e.idHomeTeam, e.idAwayTeam];
    if (!ids.includes(teamId) || !ids.includes(oppId)) continue;
    if (e.intHomeScore == null || e.intAwayScore == null) continue;
    const key = e.idEvent ?? `${e.strEvent}-${e.dateEvent}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hs = Number(e.intHomeScore);
    const as = Number(e.intAwayScore);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    const teamHome = e.idHomeTeam === teamId;
    const ts = teamHome ? hs : as;
    const os = teamHome ? as : hs;
    if (ts > os) w++;
    else if (ts < os) l++;
    else d++;
    games.push({
      date: e.dateEvent ?? null,
      event: e.strEvent ?? `${teamName} vs ${oppName}`,
      score: `${hs}–${as}`,
    });
  }
  if (games.length === 0) return null;
  games.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { teamA: teamName, teamB: oppName, record: { w, d, l }, games: games.slice(0, 6) };
}

export function extractTeamName(question: string): string | null {
  const m = question.match(
    /\bwill\s+(.+?)\s+(?:win|beat|defeat|reach|advance|qualify|make)\b/i
  );
  if (!m) return null;
  const name = m[1].trim().replace(/^the\s+/i, "").trim();
  if (name.length < 2 || name.length > 40) return null;
  if (/^\d+$/.test(name)) return null;
  return name;
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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

type Row = Record<string, string>;

async function fetchStandings(
  idLeague: string,
  season: string | null,
  involvedIds: Set<string>
): Promise<Standings | null> {
  const seasons = [season, "2026", "2025-2026", "2024", "2023"].filter(
    (s): s is string => !!s
  );
  for (const s of seasons) {
    let table: Row[] | null = null;
    try {
      const r = (await getJson(`${BASE}/lookuptable.php?l=${idLeague}&s=${s}`)) as {
        table?: Row[] | null;
      };
      table = r.table ?? null;
    } catch {
      table = null;
    }
    if (!table || table.length === 0) continue;

    // Prefer the group(s) containing the involved team(s); fall back to the
    // whole table when that group is too sparse (e.g. a future tournament).
    const groups = new Set<string>();
    for (const row of table) {
      if (row.idTeam && involvedIds.has(row.idTeam) && row.strGroup) {
        groups.add(row.strGroup);
      }
    }
    const grouped = groups.size
      ? table.filter((row) => row.strGroup && groups.has(row.strGroup))
      : [];
    const base = grouped.length >= 2 ? grouped : table;
    if (base.length < 2) continue; // nothing meaningful to show

    const rows: StandingRow[] = base.slice(0, 10).map((row) => ({
      rank: num(row.intRank),
      team: row.strTeam ?? "",
      badge: row.strBadge ?? null,
      played: num(row.intPlayed),
      win: num(row.intWin),
      draw: num(row.intDraw),
      loss: num(row.intLoss),
      gd: num(row.intGoalDifference),
      points: num(row.intPoints),
      form: row.strForm || null,
      group: row.strGroup || null,
      highlight: !!row.idTeam && involvedIds.has(row.idTeam),
    }));
    const distinct = new Set(rows.map((r) => r.group).filter(Boolean));
    return {
      league: base[0]?.strLeague ?? null,
      season: s,
      group: distinct.size === 1 ? [...distinct][0] : null,
      rows,
    };
  }
  return null;
}

async function fetchTeam(name: string): Promise<SportsInfo> {
  const search = (await getJson(
    `${BASE}/searchteams.php?t=${encodeURIComponent(name)}`
  )) as { teams?: Row[] | null };
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
        ? team.strDescriptionEN.slice(0, 200).replace(/\s+\S*$/, "") + "…"
        : null,
    },
    match: null,
    recent: [],
    standings: null,
  };

  const involved = new Set<string>([team.idTeam]);
  let season: string | null = null;
  let idLeague = team.idLeague ?? null;

  let oppId: string | null = null;
  let oppName = "";

  // Upcoming match → head-to-head (both teams).
  try {
    const next = (await getJson(`${BASE}/eventsnext.php?id=${team.idTeam}`)) as {
      events?: Row[] | null;
    };
    const e = next.events?.[0];
    if (e?.idHomeTeam && e?.idAwayTeam) {
      involved.add(e.idHomeTeam);
      involved.add(e.idAwayTeam);
      season = e.strSeason ?? season;
      idLeague = e.idLeague ?? idLeague;
      oppId = e.idHomeTeam === team.idTeam ? e.idAwayTeam : e.idHomeTeam;
      oppName =
        (e.idHomeTeam === team.idTeam ? e.strAwayTeam : e.strHomeTeam) ?? "";
      info.match = {
        date: e.dateEvent ?? null,
        venue: e.strVenue ?? null,
        league: e.strLeague ?? null,
        home: { name: e.strHomeTeam ?? "Home", badge: null, form: null },
        away: { name: e.strAwayTeam ?? "Away", badge: null, form: null },
      };
    }
  } catch {
    /* no upcoming match */
  }

  // Recent results for the primary team (raw rows reused for the H2H scan).
  let primaryLast: Row[] = [];
  try {
    const last = (await getJson(`${BASE}/eventslast.php?id=${team.idTeam}`)) as {
      results?: Row[] | null;
    };
    primaryLast = last.results ?? [];
    info.recent = primaryLast.slice(0, 5).map((e) => ({
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

  // True head-to-head: real past meetings of the two teams, gathered from both
  // teams' recent results and the league season, deduped. Best-effort on the
  // free tier (recent + current season) — empty when they haven't met.
  if (oppId && info.match) {
    const candidates: Row[] = [...primaryLast];
    try {
      const oppLast = (await getJson(`${BASE}/eventslast.php?id=${oppId}`)) as {
        results?: Row[] | null;
      };
      candidates.push(...(oppLast.results ?? []));
    } catch {
      /* ignore */
    }
    if (idLeague) {
      try {
        const seasonEv = (await getJson(
          `${BASE}/eventsseason.php?id=${idLeague}${season ? `&s=${season}` : ""}`
        )) as { events?: Row[] | null };
        candidates.push(...(seasonEv.events ?? []));
      } catch {
        /* ignore */
      }
    }
    info.h2h = summarizeH2H(
      team.idTeam,
      info.team!.name,
      oppId,
      oppName,
      candidates
    );
  }

  // Standings (group/league) — also supplies form + badges for the H2H teams.
  if (idLeague) {
    info.standings = await fetchStandings(idLeague, season, involved);
    if (info.standings && info.match) {
      const byName = new Map(
        info.standings.rows.map((r) => [r.team.toLowerCase(), r])
      );
      for (const side of [info.match.home, info.match.away]) {
        const r = byName.get(side.name.toLowerCase());
        if (r) {
          side.badge = r.badge;
          side.form = r.form;
        }
      }
    }
  }

  // Optional premium enrichment: real top scorers for soccer competitions.
  if (apiFootballEnabled() && info.team?.sport === "Soccer") {
    const hint = info.match?.league ?? info.team?.league ?? null;
    info.topScorers = await getTopScorers(info.team.name, hint);
  }

  return info;
}

/** Cached team lookup for a market question. Always resolves (never throws). */
export async function getSportsInfo(question: string): Promise<SportsInfo> {
  const name = extractTeamName(question);
  if (!name) return { available: false };

  const key = `team:v4:${name.toLowerCase()}`;
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
