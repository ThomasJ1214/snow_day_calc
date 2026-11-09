import type { HourlySeries } from "./types";

const KEYS = ["precipMm", "snowfallCm", "tempC", "rh", "gustKmh", "windKmh", "visibilityM", "weatherCode", "freezingLevelM"] as const;

/** Re-indexes a series onto `target` timestamps; hours the source lacks become null (missing, not zero). */
export function alignSeries(s: HourlySeries, target: string[]): HourlySeries {
  const idx = new Map(s.time.map((t, i) => [t, i]));
  const out = { time: [...target] } as HourlySeries;
  for (const k of KEYS) {
    const src = s[k];
    (out[k] as (number | null)[]) = target.map((t) => {
      const i = idx.get(t);
      return i == null || !src ? null : (src[i] ?? null);
    });
  }
  return out;
}
