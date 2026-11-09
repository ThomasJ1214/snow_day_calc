import type { HourPoint } from "@/lib/snow/analyze";
import { addDays } from "@/lib/calendar/dates";

const CM_PER_IN = 2.54;
const cToF = (c: number) => (c * 9) / 5 + 32;
const kmhToMph = (k: number) => k / 1.609344;

/** NWS wind chill (°F); defined for T ≤ 50 °F and wind ≥ 3 mph, otherwise the air temperature. */
export function windChillF(tF: number, windMph: number): number {
  if (tF > 50 || windMph < 3) return tF;
  const v = Math.pow(windMph, 0.16);
  return 35.74 + 0.6215 * tF - 35.75 * v + 0.4275 * tF * v;
}

export interface DayWeather {
  overnightSnowIn: number;
  commuteSnowIn: number;
  totalSnow24In: number;
  iceIn: number;
  morningLowF: number;
  windChillF: number;
  maxGustMph: number;
  minVisibilityMi: number | null;
  dismissalWindowSnowIn: number;
}

/**
 * Weather inputs for a school day (local time): overnight = prior 18:00 → 06:59, commute = 05:00 → 07:59,
 * dismissal = 10:00 → 14:59, 24 h = prior 18:00 → 17:59. Returns null unless the hourly forecast covers
 * prior 18:00 through 14:00 on the school day.
 */
export function closureInputsForDay(hourly: HourPoint[], date: string): DayWeather | null {
  const prev = addDays(date, -1);
  const byTime = new Map(hourly.map((h) => [h.time, h]));
  const at = (d: string, hr: number) => byTime.get(`${d}T${String(hr).padStart(2, "0")}:00`);
  const range = (from: [string, number], hoursCount: number) => {
    const out: HourPoint[] = [];
    for (let k = 0; k < hoursCount; k++) {
      const total = from[1] + k;
      const p = at(total >= 24 ? addDays(from[0], 1) : from[0], total % 24);
      if (p) out.push(p);
    }
    return out;
  };
  const overnight = range([prev, 18], 13);
  const required = range([prev, 18], 21);
  if (required.length < 21) return null;
  const commute = range([date, 5], 3);
  const dismissal = range([date, 10], 5);
  const day24 = range([prev, 18], 24);
  const morning = range([date, 0], 9);
  const snow = (ps: HourPoint[]) => ps.reduce((s, p) => s + p.rateLikely, 0) / CM_PER_IN;
  const temps = morning.map((p) => p.tempC).filter((v): v is number => v != null);
  const chills = commute
    .filter((p) => p.tempC != null)
    .map((p) => windChillF(cToF(p.tempC as number), kmhToMph(p.windKmh ?? 0)));
  const gusts = [...overnight, ...commute].map((p) => p.gustKmh).filter((v): v is number => v != null);
  const vis = commute.map((p) => p.visibilityM).filter((v): v is number => v != null);
  const iceMm = [...overnight, ...range([date, 7], 1)].reduce((s, p) => s + p.iceMm, 0);
  const morningLowF = temps.length ? cToF(Math.min(...temps)) : 32;
  return {
    overnightSnowIn: snow(overnight),
    commuteSnowIn: snow(commute),
    totalSnow24In: snow(day24),
    iceIn: iceMm / 25.4,
    morningLowF,
    windChillF: chills.length ? Math.min(...chills) : morningLowF,
    maxGustMph: gusts.length ? kmhToMph(Math.max(...gusts)) : 0,
    minVisibilityMi: vis.length ? Math.min(...vis) / 1609.344 : null,
    dismissalWindowSnowIn: snow(dismissal),
  };
}
