// ── Live scores (ESPN public scoreboards) ─────────────────────────────────
// Keyless, multi-sport, pollable. We fetch a handful of league scoreboards,
// normalize them, and cache in-memory for a short window (live data changes
// fast). The Matches view matches each game by team name. Never throws.

const LEAGUES = (
  process.env.SCORE_LEAGUES ??
  [
    "soccer/fifa.world",
    "soccer/fifa.friendly",
    "soccer/uefa.nations",
    "soccer/uefa.champions",
    "soccer/eng.1",
    "soccer/esp.1",
    "soccer/ita.1",
    "soccer/ger.1",
    "soccer/usa.1",
    "baseball/mlb",
    "basketball/nba",
    "hockey/nhl",
    "football/nfl",
  ].join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TTL_MS = 40_000;

export interface LiveGame {
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  /** "pre" (upcoming), "in" (live), "post" (finished). */
  state: "pre" | "in" | "post";
  /** Short status, e.g. "45'+2'", "Top 5th", "Final", "7:30 PM". */
  detail: string;
}

let cache: { ts: number; games: LiveGame[] } | null = null;
let inflight: Promise<LiveGame[]> | null = null;

async function fetchLeague(path: string): Promise<LiveGame[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`,
      { headers: { "user-agent": "Mozilla/5.0" }, signal: ctrl.signal }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: unknown[] };
    const out: LiveGame[] = [];
    for (const ev of (data.events ?? []) as Array<Record<string, unknown>>) {
      const comp = (ev.competitions as Array<Record<string, unknown>>)?.[0];
      const competitors = (comp?.competitors as Array<Record<string, unknown>>) ?? [];
      const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
      const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
      if (!home || !away) continue;
      const status = (ev.status as Record<string, unknown>)?.type as
        | Record<string, unknown>
        | undefined;
      const name = (t: Record<string, unknown>) => {
        const team = t.team as Record<string, unknown> | undefined;
        return (team?.displayName as string) ?? (team?.name as string) ?? "";
      };
      const score = (t: Record<string, unknown>) =>
        t.score != null && t.score !== "" ? Number(t.score) : null;
      out.push({
        home: name(home),
        away: name(away),
        homeScore: score(home),
        awayScore: score(away),
        state: (status?.state as LiveGame["state"]) ?? "pre",
        detail: (status?.shortDetail as string) ?? (status?.detail as string) ?? "",
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** All games across the configured leagues, cached for TTL_MS. */
export async function getScores(): Promise<LiveGame[]> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.games;
  if (inflight) return inflight;
  inflight = (async () => {
    const results = await Promise.all(LEAGUES.map(fetchLeague));
    const games = results.flat();
    cache = { ts: Date.now(), games };
    inflight = null;
    return games;
  })();
  return inflight;
}
