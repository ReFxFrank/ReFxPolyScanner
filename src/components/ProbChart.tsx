"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistorySeriesDTO } from "@/lib/api-types";

// ReFx-blue series with a soft area gradient fading to transparent; sparse
// low-opacity grid; glass tooltip with tabular numbers. Secondary series use
// the quieter accent blue so the primary line keeps the glow/weight.
const SERIES_COLORS = ["#0072ff", "#58a7d3", "#7db7ff", "#9dccff", "#f5b14c"];

export function ProbChart({ series }: { series: HistorySeriesDTO[] }) {
  const withData = series.filter((s) => s.points.length > 0);
  if (withData.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-refx-meta">
        No history yet — the chart fills in as the poller runs.
      </div>
    );
  }

  const tsSet = new Set<number>();
  for (const s of withData) for (const p of s.points) tsSet.add(p.ts);
  const tsList = Array.from(tsSet).sort((a, b) => a - b);

  const byTokenTs = new Map<string, Map<number, number>>();
  for (const s of withData) {
    const m = new Map<number, number>();
    for (const p of s.points) m.set(p.ts, p.mid);
    byTokenTs.set(s.tokenId, m);
  }

  const data = tsList.map((ts) => {
    const row: Record<string, number> = { ts };
    for (const s of withData) {
      const v = byTokenTs.get(s.tokenId)?.get(ts);
      if (v != null) row[s.tokenId] = v * 100;
    }
    return row;
  });

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <defs>
          {withData.map((s, i) => (
            <linearGradient key={s.tokenId} id={`grad-${s.tokenId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--refx-grid)" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="ts"
          tickFormatter={fmtTime}
          stroke="var(--refx-label)"
          tick={{ fill: "var(--refx-label)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          minTickGap={40}
        />
        <YAxis
          domain={[0, 100]}
          stroke="var(--refx-label)"
          tick={{ fill: "var(--refx-label)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          width={42}
        />
        <Tooltip
          cursor={{ stroke: "rgba(0,114,255,0.5)", strokeDasharray: "3 3" }}
          contentStyle={{
            background: "rgba(10,18,32,0.92)",
            border: "1px solid rgba(0,114,255,0.22)",
            borderRadius: 10,
            fontSize: 12,
            backdropFilter: "blur(6px)",
            boxShadow: "0 8px 28px -10px rgba(0,114,255,0.35)",
          }}
          labelStyle={{ color: "var(--refx-label)" }}
          itemStyle={{ fontVariantNumeric: "tabular-nums" }}
          labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
          formatter={(v: number, name) => {
            const s = withData.find((x) => x.tokenId === name);
            return [`${v.toFixed(1)}%`, s?.outcome ?? name];
          }}
        />
        {withData.map((s, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <Area
              key={s.tokenId}
              type="monotone"
              dataKey={s.tokenId}
              name={s.tokenId}
              stroke={color}
              strokeWidth={i === 0 ? 2.2 : 1.6}
              fill={`url(#grad-${s.tokenId})`}
              dot={false}
              connectNulls
              isAnimationActive={false}
              style={i === 0 ? { filter: "drop-shadow(0 0 6px rgba(0,114,255,0.45))" } : undefined}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
