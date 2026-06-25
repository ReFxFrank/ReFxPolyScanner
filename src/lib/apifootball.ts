// ── API-Football enrichment (optional, keyed) ─────────────────────────────
// When APIFOOTBALL_KEY is set, adds real top-scorer tables to SOCCER markets.
// Free tier is ~100 requests/day, so every call is cached in sports_cache with
// generous TTLs and the league top-scorer table is shared across all teams in
// that competition. Never throws — returns null on any miss.

import { getSportsCache, setSportsCache } from "./store";

const BASE = process.env.APIFOOTBALL_BASE ?? "https://v3.football.api-sports.io";
const POS_TTL = 12 * 3600_000; // 12h for a good result
const NEG_TTL = 60 * 60_000; // 1h for a miss
const ID_TTL = 7 * 86_400_000; // 7d for stable id/league resolution

export function apiFootballEnabled(): boolean {
  return !!process.env.APIFOOTBALL_KEY;
}

export interface TopScorers {
  league: string;
  scorers: { name: string; team: string; goals: number }[];
}

async function af(path: string, timeoutMs = 12000): Promise<{ response?: unknown[] }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "x-apisports-key": process.env.APIFOOTBALL_KEY as string },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as { response?: unknown[] };
  } finally {
    clearTimeout(t);
  }
}

// Cache wrapper: stores even null results (shorter TTL) to avoid hammering the
// daily quota on repeated misses.
async function cached<T>(
  key: string,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const hit = getSportsCache(key);
  if (hit) {
    const val = JSON.parse(hit.payload) as T | null;
    const ttl = val ? POS_TTL : NEG_TTL;
    if (Date.now() - hit.ts < ttl) return val;
  }
  let val: T | null = null;
  try {
    val = await fetcher();
  } catch {
    val = null;
  }
  setSportsCache(key, JSON.stringify(val), Date.now());
  return val;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

interface LeagueRef {
  id: number;
  name: string;
  seasons: number[];
}

/** Pick the league best matching a competition hint (e.g. "FIFA World Cup"). */
function pickLeague(leagues: LeagueRef[], hint: string | null): LeagueRef | null {
  const valid = leagues.filter((l) => l.seasons.length > 0);
  if (valid.length === 0) return null;
  if (hint) {
    const want = new Set(norm(hint).split(" ").filter((w) => w.length > 2));
    let best: LeagueRef | null = null;
    let score = 0;
    for (const l of valid) {
      const overlap = norm(l.name)
        .split(" ")
        .filter((w) => want.has(w)).length;
      if (overlap > score) {
        score = overlap;
        best = l;
      }
    }
    if (best && score > 0) return best;
  }
  const priority = ["world cup", "euro", "champions", "premier", "la liga", "serie a", "bundesliga"];
  for (const p of priority) {
    const m = valid.find((l) => norm(l.name).includes(p));
    if (m) return m;
  }
  return valid.find((l) => !/friend/i.test(l.name)) ?? valid[0];
}

/** Resolve the API-Football team id for a name (prefer national teams). */
async function resolveTeamId(name: string): Promise<number | null> {
  return cached(`af:team:${name.toLowerCase()}`, async () => {
    const r = await af(`/teams?search=${encodeURIComponent(name)}`);
    const list = (r.response ?? []) as Array<{ team: { id: number; national: boolean } }>;
    const pick = list.find((x) => x.team.national) ?? list[0];
    return pick ? pick.team.id : null;
  });
}

/** Top scorers for the competition a team is in, matched to a hint. */
export async function getTopScorers(
  teamName: string,
  competitionHint: string | null
): Promise<TopScorers | null> {
  if (!apiFootballEnabled() || !teamName) return null;

  const teamId = await resolveTeamId(teamName);
  if (!teamId) return null;

  const league = await cached<LeagueRef>(
    `af:league:${teamId}:${norm(competitionHint ?? "")}`,
    async () => {
      const r = await af(`/leagues?team=${teamId}`);
      const leagues = ((r.response ?? []) as Array<{
        league: { id: number; name: string };
        seasons: Array<{ year: number }>;
      }>).map((x) => ({
        id: x.league.id,
        name: x.league.name,
        seasons: (x.seasons ?? []).map((s) => s.year).filter(Boolean),
      })) as LeagueRef[];
      return pickLeague(leagues, competitionHint);
    }
  );
  if (!league) return null;

  // Try the most recent *played* seasons (a future World Cup has none yet, so
  // fall back to the last completed edition). Each (league, season) table is
  // cached and shared across every team in that competition.
  const thisYear = new Date().getFullYear();
  const seasons = league.seasons
    .filter((y) => y <= thisYear)
    .sort((a, b) => b - a)
    .slice(0, 4);

  for (const season of seasons) {
    const scorers = await cached(
      `af:topscorers:${league.id}:${season}`,
      async () => {
        const r = await af(`/players/topscorers?league=${league.id}&season=${season}`);
        const rows = (r.response ?? []) as Array<{
          player: { name: string };
          statistics: Array<{ team: { name: string }; goals: { total: number | null } }>;
        }>;
        return rows.slice(0, 8).map((p) => ({
          name: p.player.name,
          team: p.statistics[0]?.team?.name ?? "",
          goals: p.statistics[0]?.goals?.total ?? 0,
        }));
      }
    );
    if (scorers && scorers.length > 0) {
      return { league: `${league.name} ${season}`, scorers };
    }
  }
  return null;
}
