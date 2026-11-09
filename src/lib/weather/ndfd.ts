export interface NdfdValue {
  validTime: string;
  value: number | null;
}

/** Parses an NWS ISO-8601 interval "2026-11-09T06:00:00+00:00/PT6H" (also P1DT6H). */
export function parseValidTime(v: string): { startMs: number; hours: number } | null {
  const [start, dur] = v.split("/");
  const startMs = Date.parse(start);
  const m = dur?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!Number.isFinite(startMs) || !m) return null;
  const hours = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
  return hours > 0 ? { startMs, hours } : null;
}

/**
 * Sums interval values over [windowStart, windowStart + hours), prorating partial overlap.
 * Returns null when the data does not cover the whole window (never a silent partial total).
 */
export function sumIntervals(values: NdfdValue[], windowStartMs: number, hours: number): number | null {
  const windowEnd = windowStartMs + hours * 3600_000;
  let covered = 0;
  let sum = 0;
  for (const v of values) {
    const p = parseValidTime(v.validTime);
    if (!p) continue;
    const s = p.startMs;
    const e = s + p.hours * 3600_000;
    const overlap = Math.min(e, windowEnd) - Math.max(s, windowStartMs);
    if (overlap <= 0) continue;
    if (v.value == null) continue;
    covered += overlap;
    sum += v.value * (overlap / (e - s));
  }
  return covered >= hours * 3600_000 - 1 ? sum : null;
}
