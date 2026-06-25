"use client";

import { useEffect, useState } from "react";
import type { SportsDTO } from "@/lib/api-types";
import { GlassPanel } from "./ui/GlassPanel";
import { Eyebrow } from "./ui/Controls";

// Team context for sports markets — head-to-head for an upcoming match, recent
// form, and the group/league standings. Best-effort: renders nothing if no team
// matched. Pure context, never framed as a prediction.
export function SportsPanel({ slug }: { slug: string }) {
  const [data, setData] = useState<SportsDTO | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/sports?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  if (!data || !data.available || !data.team) return null;
  const { team, match, h2h, recent, standings } = data;

  return (
    <GlassPanel className="p-3.5">
      <Eyebrow className="mb-2.5">
        {match ? "Match · head to head" : "Team snapshot"}
      </Eyebrow>

      {match ? (
        <div className="flex items-stretch gap-2">
          <TeamSide name={match.home.name} badge={match.home.badge} form={match.home.form} />
          <div className="flex flex-col items-center justify-center px-1 text-center">
            <span className="text-xs font-semibold text-refx-meta">vs</span>
          </div>
          <TeamSide name={match.away.name} badge={match.away.badge} form={match.away.form} align="right" />
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <Badge src={team.badge} />
          <div className="min-w-0">
            <div className="font-semibold text-refx-text2">{team.name}</div>
            <div className="text-xs text-refx-meta">
              {[team.sport, team.league, team.country].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      )}

      {match && (match.date || match.venue) && (
        <div className="mt-2 text-center text-[11px] text-refx-meta">
          {[match.date, match.venue, match.league].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* True head-to-head — real past meetings of the two teams */}
      {h2h && h2h.games.length > 0 && (
        <div className="mt-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="eyebrow">Head-to-head</span>
            <span className="text-[11px] text-refx-meta">
              {h2h.teamA}{" "}
              <span className="tabular text-refx-text">
                {h2h.record.w}-{h2h.record.d}-{h2h.record.l}
              </span>{" "}
              {h2h.teamB} <span className="text-refx-meta">(W-D-L)</span>
            </span>
          </div>
          <ul className="space-y-1">
            {h2h.games.map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-refx-muted">
                  {g.date ? `${g.date} · ` : ""}
                  {g.event}
                </span>
                <span className="shrink-0 tabular text-refx-text">{g.score ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Standings (group/league table) */}
      {standings && standings.rows.length > 0 && (
        <div className="mt-3.5">
          <div className="eyebrow mb-1.5">
            Standings{standings.group ? ` · Group ${standings.group}` : ""}
          </div>
          <div className="overflow-hidden rounded-refx-sm border border-refx-soft">
            <table className="w-full text-[12px] tabular">
              <thead className="text-refx-meta">
                <tr className="border-b border-refx-soft">
                  <th className="px-2 py-1 text-left font-normal">#</th>
                  <th className="px-2 py-1 text-left font-normal">Team</th>
                  {!standings.group && (
                    <th className="px-1 py-1 text-center font-normal">Grp</th>
                  )}
                  <th className="px-1 py-1 text-right font-normal">P</th>
                  <th className="px-1 py-1 text-right font-normal">W-D-L</th>
                  <th className="px-1 py-1 text-right font-normal">GD</th>
                  <th className="px-2 py-1 text-right font-normal">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.rows.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-t border-white/[0.04] ${r.highlight ? "bg-refx-blue/10 text-refx-text" : "text-refx-muted"}`}
                  >
                    <td className="px-2 py-1">{r.rank ?? i + 1}</td>
                    <td className="px-2 py-1">
                      <span className={r.highlight ? "font-semibold" : ""}>
                        {r.team}
                      </span>
                    </td>
                    {!standings.group && (
                      <td className="px-1 py-1 text-center text-refx-meta">
                        {r.group ?? "—"}
                      </td>
                    )}
                    <td className="px-1 py-1 text-right">{r.played ?? "—"}</td>
                    <td className="px-1 py-1 text-right">
                      {[r.win, r.draw, r.loss].map((v) => v ?? 0).join("-")}
                    </td>
                    <td className="px-1 py-1 text-right">
                      {r.gd == null ? "—" : r.gd > 0 ? `+${r.gd}` : r.gd}
                    </td>
                    <td className="px-2 py-1 text-right font-semibold">
                      {r.points ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent results for the named team */}
      {recent && recent.length > 0 && (
        <div className="mt-3">
          <div className="eyebrow mb-1.5">{team.name} · recent</div>
          <ul className="space-y-1">
            {recent.slice(0, 4).map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-refx-muted">{g.event}</span>
                <span className="shrink-0 tabular text-refx-text">{g.score ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2.5 text-[10px] leading-snug text-refx-meta">
        Stats via TheSportsDB — context only, not a prediction. Markets resolve on
        the official result.
      </p>
    </GlassPanel>
  );
}

function TeamSide({
  name,
  badge,
  form,
  align = "left",
}: {
  name: string;
  badge: string | null;
  form: string | null;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-1 flex-col gap-1.5 ${align === "right" ? "items-end" : "items-start"}`}>
      <Badge src={badge} />
      <div className="text-sm font-semibold leading-tight text-refx-text2">{name}</div>
      {form && <FormPips form={form} />}
    </div>
  );
}

function FormPips({ form }: { form: string }) {
  // form like "WWDLW" — most recent last. Show up to 5.
  const pips = form.slice(-5).split("");
  const cls: Record<string, string> = {
    W: "bg-status-live/80",
    D: "bg-status-stale/80",
    L: "bg-status-error/80",
  };
  return (
    <div className="flex gap-0.5">
      {pips.map((c, i) => (
        <span
          key={i}
          title={c}
          className={`h-1.5 w-3 rounded-sm ${cls[c.toUpperCase()] ?? "bg-white/20"}`}
        />
      ))}
    </div>
  );
}

function Badge({ src }: { src: string | null }) {
  if (!src) return <div className="h-10 w-10 shrink-0 rounded-md bg-white/5" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
      className="h-10 w-10 shrink-0 rounded-md bg-white/5 object-contain p-0.5"
    />
  );
}
