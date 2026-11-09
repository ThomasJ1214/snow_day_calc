"use client";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HourPoint } from "./types";
import { CM_PER_IN, fmtLocal } from "@/lib/client/format";

/** Accumulation timeline: likely total (line) inside the 10th–90th percentile band, with hourly rate bars. */
export function AccumulationChart({ hourly, unit }: { hourly: HourPoint[]; unit: "in" | "cm" }) {
  const k = unit === "in" ? 1 / CM_PER_IN : 1;
  const data = hourly
    .filter((h) => !h.past)
    .map((h) => ({
      t: h.time,
      band: h.cumLow != null && h.cumHigh != null ? [+(h.cumLow * k).toFixed(2), +(h.cumHigh * k).toFixed(2)] : null,
      likely: h.cumLikely != null ? +(h.cumLikely * k).toFixed(2) : null,
      rate: +(h.rateLikely * k).toFixed(2),
    }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Snow accumulation over the next 72 hours with uncertainty band">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="t" tickFormatter={(t: string) => fmtLocal(t, { weekday: "short", hour: "numeric" })} interval={11} tick={{ fill: "var(--text-3)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="acc" tick={{ fill: "var(--text-3)", fontSize: 12 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${v}${unit === "in" ? "″" : ""}`} />
          <YAxis yAxisId="rate" hide orientation="right" />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            contentStyle={{ background: "var(--bg)", border: "none", borderRadius: 14, color: "var(--text)", boxShadow: "6px 6px 14px var(--sh-dark), -6px -6px 14px var(--sh-light)" }}
            labelFormatter={(t) => fmtLocal(String(t), { weekday: "short", hour: "numeric", minute: "2-digit" })}
            formatter={(v, name) => {
              const u = unit === "in" ? "″" : " cm";
              if (name === "band" && Array.isArray(v)) return [`${v[0]}–${v[1]}${u}`, "Range (10th–90th pct.)"];
              if (name === "likely") return [`${v}${u}`, "Most likely total"];
              return [`${v}${u}/h`, "Hourly rate"];
            }}
          />
          <Bar yAxisId="rate" dataKey="rate" fill="var(--accent)" opacity={0.3} radius={[3, 3, 0, 0]} />
          <Area yAxisId="acc" dataKey="band" stroke="none" fill="var(--violet)" fillOpacity={0.18} isAnimationActive={false} />
          <Line yAxisId="acc" dataKey="likely" stroke="var(--text)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
