"use client";

import { useEffect, useState } from "react";
import type { SportsDTO } from "@/lib/api-types";
import { GlassPanel } from "./ui/GlassPanel";
import { Eyebrow } from "./ui/Controls";

// Team context for sports markets — badge, league, recent form, next match.
// Best-effort: renders nothing if the lookup found no team.
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
  const { team, recent, next } = data;

  return (
    <GlassPanel className="p-3.5">
      <Eyebrow className="mb-2.5">Team snapshot</Eyebrow>
      <div className="flex items-start gap-3">
        {team.badge && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.badge}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="h-11 w-11 shrink-0 rounded-md bg-white/5 object-contain p-0.5"
          />
        )}
        <div className="min-w-0">
          <div className="font-semibold text-refx-text2">{team.name}</div>
          <div className="text-xs text-refx-meta">
            {[team.sport, team.league, team.country].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {recent && recent.length > 0 && (
        <div className="mt-3">
          <div className="eyebrow mb-1.5">Recent results</div>
          <ul className="space-y-1">
            {recent.map((g, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-refx-muted">{g.event}</span>
                <span className="shrink-0 tabular text-refx-text">
                  {g.score ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {next && (
        <div className="mt-3 border-t border-white/[0.06] pt-2.5 text-sm">
          <span className="eyebrow">Next</span>{" "}
          <span className="text-refx-text">{next.event}</span>
          {next.date && (
            <span className="text-refx-meta"> · {next.date}</span>
          )}
        </div>
      )}

      <p className="mt-2.5 text-[10px] leading-snug text-refx-meta">
        Stats via TheSportsDB — context only, not a prediction. Markets resolve on
        the official result.
      </p>
    </GlassPanel>
  );
}
