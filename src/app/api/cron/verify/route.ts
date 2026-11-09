import type { NextRequest } from "next/server";
import { registryDistricts } from "@/lib/official/registry";
import { verifyDistrict } from "@/lib/official/verify";
import { recordOfficialEvent, recordPrediction } from "@/lib/history/record";
import { searchSchools } from "@/lib/schools/repo";
import { getSchoolPrediction } from "@/lib/forecast/school";
import { getLocationForecast } from "@/lib/forecast/service";
import { adminClient } from "@/lib/supabase/admin";
import { apiError, json } from "@/lib/server/api";
import { cronAuthorized } from "@/lib/server/cron";

export const maxDuration = 300;
const MONTVILLE = "3410650";

/**
 * Daily job: (1) pre-warms Montville's forecast, (2) checks every registry district's official feed and
 * records verified closures/delays, (3) logs our prediction for districts users follow (calibration data).
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return apiError("unauthorized", "Invalid cron secret.", 401);
  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  await getLocationForecast(40.9154, -74.3638).catch(() => null);

  const districts = registryDistricts();
  const ordered = [...districts.filter((d) => d.leaid === MONTVILLE), ...districts.filter((d) => d.leaid !== MONTVILLE)];
  let recorded = 0;
  for (let i = 0; i < ordered.length && Date.now() - started < 200_000; i += 12) {
    await Promise.all(
      ordered.slice(i, i + 12).map(async (d) => {
        const s = await verifyDistrict(d.leaid, d.website ?? null).catch(() => null);
        if (s && (s.status === "officially_closed" || s.status === "officially_delayed")) {
          await recordOfficialEvent(d.leaid, d.name, today, s);
          recorded++;
        }
      }),
    );
  }

  let predictions = 0;
  const db = adminClient();
  const followed = new Set<string>([MONTVILLE]);
  if (db) {
    const { data } = await db.from("saved_schools").select("leaid").not("leaid", "is", null).limit(1000);
    for (const r of data ?? []) followed.add(r.leaid as string);
  }
  for (const leaid of [...followed].slice(0, 60)) {
    if (Date.now() - started > 270_000) break;
    const district = districts.find((d) => d.leaid === leaid)?.name;
    const schools = await searchSchools({ q: district ?? undefined, limit: 50 }).catch(() => null);
    const school = schools?.value.find((s) => s.leaid === leaid);
    if (!school) continue;
    const p = await getSchoolPrediction(school).catch(() => null);
    if (p?.ok && p.data.prediction) {
      await recordPrediction(leaid, p.data.targetDay, p.data.prediction.closurePct, p.data.prediction.delayPct);
      predictions++;
    }
  }
  return json({ districtsChecked: ordered.length, officialEventsRecorded: recorded, predictionsLogged: predictions, ms: Date.now() - started });
}
