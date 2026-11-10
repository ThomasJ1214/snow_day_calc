export interface Target {
  key: string;
  kind: "school" | "location";
  name: string;
  url: string;
  /** Local calendar date at the target when evaluated (dedupe window). */
  localDate: string;
  targetDay: string | null;
  closurePct: number | null;
  delayPct: number | null;
  snow24In: number;
  official: { status: string; headline: string } | null;
}

export interface Prefs {
  closureThreshold: number;
  snowThresholdIn: number;
  notifyOfficial: boolean;
  enabled: boolean;
}

export interface PendingNotification {
  dedupeKey: string;
  targetKey: string;
  kind: "official" | "closure_risk" | "heavy_snow";
  localDate: string;
  title: string;
  body: string;
  url: string;
}

const dayName = (d: string | null) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) : "the next school day";

/** Decides which notifications to send; `sent` holds "<targetKey>|<kind>|<localDate>" already delivered. */
export function evaluateNotifications(targets: Target[], prefs: Prefs, sent: Set<string>): PendingNotification[] {
  if (!prefs.enabled) return [];
  const out: PendingNotification[] = [];
  const push = (t: Target, n: Omit<PendingNotification, "dedupeKey" | "targetKey" | "localDate" | "url">) => {
    const dedupeKey = `${t.key}|${n.kind}|${t.localDate}`;
    if (sent.has(dedupeKey)) return;
    out.push({ ...n, dedupeKey, targetKey: t.key, localDate: t.localDate, url: t.url });
  };
  for (const t of targets) {
    const official = t.official && (t.official.status === "officially_closed" || t.official.status === "officially_delayed");
    if (official && prefs.notifyOfficial) {
      push(t, {
        kind: "official",
        title: `${t.official!.status === "officially_closed" ? "Officially closed" : "Officially delayed"}: ${t.name}`,
        body: t.official!.headline.slice(0, 180),
      });
      continue;
    }
    if (t.kind === "school" && t.closurePct != null && t.closurePct >= prefs.closureThreshold) {
      push(t, {
        kind: "closure_risk",
        title: `${t.closurePct}% chance ${t.name} closes ${dayName(t.targetDay)}`,
        body: `Delay chance ${t.delayPct ?? 0}%. This is a Snow Day Scout prediction, not an official announcement.`,
      });
    }
    if (t.snow24In >= prefs.snowThresholdIn) {
      push(t, {
        kind: "heavy_snow",
        title: `${t.snow24In.toFixed(1)}″ of snow expected at ${t.name}`,
        body: "Most likely total for the next 24 hours. Tap for the range and timing.",
      });
    }
  }
  return out;
}
