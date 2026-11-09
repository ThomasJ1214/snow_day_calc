/** Date-only helpers on "YYYY-MM-DD" strings (UTC arithmetic, so no DST/timezone drift). */
export const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromMs(toMs(d) + n * 86_400_000);
/** 0 = Sunday … 6 = Saturday */
export const weekday = (d: string) => new Date(toMs(d)).getUTCDay();
export const ymd = (y: number, m: number, day: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
