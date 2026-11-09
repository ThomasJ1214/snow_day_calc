export interface Pair {
  /** predicted probability 0–1 */
  p: number;
  /** outcome 1 (happened) or 0 */
  o: 0 | 1;
}

export function brierScore(pairs: Pair[]): number {
  if (!pairs.length) return NaN;
  return pairs.reduce((s, x) => s + (x.p - x.o) ** 2, 0) / pairs.length;
}

export const MIN_CALIBRATION_DAYS = 10;

export function calibration(pairs: Pair[]): { n: number; brier: number } | null {
  if (pairs.length < MIN_CALIBRATION_DAYS) return null;
  return { n: pairs.length, brier: Math.round(brierScore(pairs) * 1000) / 1000 };
}

/** School-year season label: July–June, e.g. "2025–26". */
export function seasonOf(date: string): string {
  const y = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 7 ? y : y - 1;
  return `${start}–${String(start + 1).slice(2)}`;
}

export function seasonCounts(events: { date: string; status: "closed" | "delayed" }[]) {
  const m = new Map<string, { season: string; closed: number; delayed: number }>();
  for (const e of events) {
    const s = seasonOf(e.date);
    const row = m.get(s) ?? { season: s, closed: 0, delayed: 0 };
    row[e.status]++;
    m.set(s, row);
  }
  return [...m.values()].sort((a, b) => b.season.localeCompare(a.season));
}
