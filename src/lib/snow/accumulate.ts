export const WINDOWS = [3, 6, 12, 24, 48, 72] as const;
export type WindowHours = (typeof WINDOWS)[number];

/**
 * Totals over the next N hours starting at `startIdx`. A window is `null` when the data
 * does not cover it completely (array too short, or a missing hour inside it) — partial
 * sums would understate snowfall.
 */
export function windowTotals(values: (number | null)[], startIdx: number): Record<WindowHours, number | null> {
  const out = {} as Record<WindowHours, number | null>;
  for (const w of WINDOWS) {
    const end = startIdx + w;
    if (end > values.length) {
      out[w] = null;
      continue;
    }
    let sum = 0;
    let complete = true;
    for (let i = startIdx; i < end; i++) {
      const v = values[i];
      if (v == null || Number.isNaN(v)) {
        complete = false;
        break;
      }
      sum += v;
    }
    out[w] = complete ? sum : null;
  }
  return out;
}

/** Running totals from startIdx; entries become null after the first missing hour. */
export function cumulative(values: (number | null)[], startIdx: number, hours: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum: number | null = 0;
  for (let i = startIdx; i < startIdx + hours; i++) {
    const v = i < values.length ? values[i] : null;
    sum = sum == null || v == null || Number.isNaN(v) ? null : sum + v;
    out.push(sum);
  }
  return out;
}
