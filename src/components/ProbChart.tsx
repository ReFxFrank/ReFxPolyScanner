"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistorySeriesDTO } from "@/lib/api-types";

const COLORS = ["#22c55e", "#a855f7", "#38bdf8", "#f59e0b", "#f472b6"];

// Implied-probability-over-time from prob_history. One line per outcome token.
export function ProbChart({ series }: { series: HistorySeriesDTO[] }) {
  const withData = series.filter((s) => s.points.length > 0);
  if (withData.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-panel-muted">
        No history yet — the chart fills in as the poller runs.
      </div>
    );
  }

  // Merge all series onto a shared timestamp axis.
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
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis
          dataKey="ts"
          tickFormatter={fmtTime}
          stroke="#8b98a9"
          fontSize={11}
          minTickGap={40}
        />
        <YAxis
          domain={[0, 100]}
          stroke="#8b98a9"
          fontSize={11}
          tickFormatter={(v) => `${v}%`}
          width={42}
        />
        <Tooltip
          contentStyle={{
            background: "#121821",
            border: "1px solid #1f2937",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
          formatter={(v: number, name) => {
            const s = withData.find((x) => x.tokenId === name);
            return [`${v.toFixed(1)}%`, s?.outcome ?? name];
          }}
        />
        {withData.map((s, i) => (
          <Line
            key={s.tokenId}
            type="monotone"
            dataKey={s.tokenId}
            name={s.tokenId}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
