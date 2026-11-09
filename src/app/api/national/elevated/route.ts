import type { NextRequest } from "next/server";
import { getNationalSummary } from "@/lib/national/summary";
import { schoolsNear } from "@/lib/schools/repo";
import { getSchoolPrediction } from "@/lib/forecast/school";
import { json, rateLimited } from "@/lib/server/api";

export const maxDuration = 60;

/**
 * Schools with elevated closure probabilities: real NCES schools near the snowiest reference
 * cities, each run through the full prediction (school location forecast + calendar + engine).
 */
export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  const summary = await getNationalSummary().catch(() => null);
  if (!summary) return json({ schools: [], note: "National data unavailable." });
  const snowy = summary.cities.filter((c) => (c.total72Cm ?? 0) >= 2.5).sort((a, b) => (b.total72Cm ?? 0) - (a.total72Cm ?? 0)).slice(0, 5);
  const results = (
    await Promise.all(
      snowy.map(async (c) => {
        const near = await schoolsNear(c.lat, c.lon, 6, 2).catch(() => null);
        return Promise.all(
          (near?.value ?? []).filter((s) => s.type === "public").slice(0, 2).map(async (s) => {
            const p = await getSchoolPrediction(s).catch(() => null);
            if (!p?.ok || !p.data.prediction) return null;
            return { id: s.id, name: s.name, city: `${c.name}, ${c.state}`, district: s.district, closurePct: p.data.prediction.closurePct, delayPct: p.data.prediction.delayPct, targetDay: p.data.targetDayLabel };
          }),
        );
      }),
    )
  )
    .flat()
    .filter((x): x is NonNullable<typeof x> => x != null && x.closurePct + x.delayPct >= 20)
    .sort((a, b) => b.closurePct - a.closurePct);
  return json({ schools: results, checkedCities: snowy.map((c) => `${c.name}, ${c.state}`) }, { sMaxAge: 1800, swr: 3600 });
}
