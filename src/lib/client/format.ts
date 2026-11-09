export const CM_PER_IN = 2.54;
export const inches = (cm: number) => cm / CM_PER_IN;

/** Snow amounts: tenths below 10″, whole inches above. */
export function fmtIn(cm: number | null | undefined): string {
  if (cm == null) return "—";
  const v = inches(cm);
  if (v > 0 && v < 0.1) return "<0.1″";
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}″`;
}
export function fmtCm(cm: number | null | undefined): string {
  if (cm == null) return "—";
  return cm > 0 && cm < 0.25 ? "<0.3 cm" : `${cm >= 10 ? Math.round(cm) : Math.round(cm * 10) / 10} cm`;
}
export const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
export const kmhToMph = (k: number) => Math.round(k / 1.609344);
export const mToMi = (m: number) => m / 1609.344;

/** "Tue 3 PM" from a local wall-clock string "2026-12-08T15:00". */
export function fmtLocal(t: string | null, opts: Intl.DateTimeFormatOptions = { weekday: "short", hour: "numeric" }): string {
  if (!t) return "—";
  return new Date(`${t}:00Z`).toLocaleString("en-US", { ...opts, timeZone: "UTC" });
}
export function fmtDay(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
export function timeAgo(iso: string | null): string {
  if (!iso) return "unknown";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}
export function riskTone(pct: number): "low" | "moderate" | "high" | "very-high" {
  return pct >= 75 ? "very-high" : pct >= 50 ? "high" : pct >= 25 ? "moderate" : "low";
}

/** Short timezone name (e.g. "EST") for an IANA zone; falls back to the provided label. */
export function tzAbbr(timezone: string, fallback: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    return part?.value ?? fallback;
  } catch {
    return fallback;
  }
}
