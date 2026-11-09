import type { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSchool } from "@/lib/schools/repo";
import { getSchoolPrediction } from "@/lib/forecast/school";
import { getLocationForecast } from "@/lib/forecast/service";
import { evaluateNotifications, type Target } from "@/lib/push/evaluate";
import { pushConfigured, sendPush } from "@/lib/push/send";
import { apiError, json } from "@/lib/server/api";
import { cronAuthorized } from "@/lib/server/cron";
import { encodeSlug } from "@/lib/geo/slug";

export const maxDuration = 300;
const CM_PER_IN = 2.54;

/** Evaluates every user's saved schools/locations and sends Web Push notifications (deduplicated per day). */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return apiError("unauthorized", "Invalid cron secret.", 401);
  const db = adminClient();
  if (!db || !pushConfigured) return json({ skipped: "Supabase service role or VAPID keys not configured" });
  const started = Date.now();
  const { data: subs } = await db.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
  const users = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  let sent = 0;
  let pruned = 0;
  const schoolCache = new Map<string, Target | null>();

  for (const userId of users) {
    if (Date.now() - started > 270_000) break;
    const [{ data: prefs }, { data: schools }, { data: locations }, { data: cals }, { data: log }] = await Promise.all([
      db.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle(),
      db.from("saved_schools").select("school_id").eq("user_id", userId),
      db.from("saved_locations").select("name, lat, lon").eq("user_id", userId),
      db.from("school_calendars").select("school_id, ics_url").eq("user_id", userId),
      db.from("notification_log").select("target_key, kind, local_date").eq("user_id", userId).gte("local_date", new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)),
    ]);
    const targets: Target[] = [];
    for (const s of schools ?? []) {
      const ics = cals?.find((c) => c.school_id === s.school_id)?.ics_url ?? null;
      const cacheKey = `${s.school_id}|${ics ?? ""}`;
      if (!schoolCache.has(cacheKey)) {
        const school = await getSchool(s.school_id).catch(() => null);
        const p = school?.value ? await getSchoolPrediction(school.value, { userIcs: ics }) : null;
        schoolCache.set(
          cacheKey,
          p?.ok
            ? {
                key: `school:${s.school_id}`,
                kind: "school",
                name: p.data.school.name,
                url: `/school/${s.school_id}`,
                localDate: p.data.forecast.localNow.slice(0, 10),
                targetDay: p.data.targetDay,
                closurePct: p.data.prediction?.closurePct ?? null,
                delayPct: p.data.prediction?.delayPct ?? null,
                snow24In: p.data.forecast.snow.windows["24"].likely / CM_PER_IN,
                official: { status: p.data.official.status, headline: p.data.official.headline },
              }
            : null,
        );
      }
      const t = schoolCache.get(cacheKey);
      if (t) targets.push(t);
    }
    for (const l of locations ?? []) {
      const f = await getLocationForecast(l.lat, l.lon);
      if (!f.ok) continue;
      targets.push({
        key: `loc:${l.lat.toFixed(2)},${l.lon.toFixed(2)}`,
        kind: "location",
        name: l.name,
        url: `/forecast/${encodeSlug(l)}`,
        localDate: f.data.localNow.slice(0, 10),
        targetDay: null,
        closurePct: null,
        delayPct: null,
        snow24In: f.data.snow.windows["24"].likely / CM_PER_IN,
        official: null,
      });
    }
    const sentKeys = new Set((log ?? []).map((r) => `${r.target_key}|${r.kind}|${r.local_date}`));
    const pending = evaluateNotifications(
      targets,
      {
        closureThreshold: prefs?.closure_threshold ?? 60,
        snowThresholdIn: Number(prefs?.snow_threshold_in ?? 2),
        notifyOfficial: prefs?.notify_official ?? true,
        enabled: prefs?.enabled ?? true,
      },
      sentKeys,
    );
    for (const n of pending) {
      let delivered = false;
      for (const s of (subs ?? []).filter((x) => x.user_id === userId)) {
        const r = await sendPush(s, { title: n.title, body: n.body, url: n.url, tag: n.dedupeKey });
        if (r === "ok") delivered = true;
        if (r === "gone") {
          await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          pruned++;
        }
      }
      if (delivered) {
        sent++;
        await db.from("notification_log").insert({ user_id: userId, target_key: n.targetKey, kind: n.kind, local_date: n.localDate });
      }
    }
  }
  return json({ users: users.length, sent, pruned, ms: Date.now() - started });
}
