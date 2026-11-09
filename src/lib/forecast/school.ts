import "server-only";
import { getLocationForecast, type LocationForecast } from "./service";
import { closureInputsForDay, type DayWeather } from "@/lib/predict/inputs";
import { predictClosure, type ClosurePrediction } from "@/lib/predict/closure";
import { federalHolidays } from "@/lib/calendar/federal";
import { parseNoSchoolDays } from "@/lib/calendar/ics";
import { nextSchoolDay, SCHOOL_START_HOUR } from "@/lib/calendar/school-day";
import { addDays } from "@/lib/calendar/dates";
import { getRegistryEntry } from "@/lib/official/registry";
import { verifyDistrict } from "@/lib/official/verify";
import { eventsToNoSchoolDays } from "@/lib/official/apptegy";
import { fetchApptegyEvents } from "@/lib/official/apptegy-fetch";
import type { OfficialStatus } from "@/lib/official/status";
import { fetchWithTimeout } from "@/lib/server/http";
import { isPublicHttpsUrl } from "@/lib/server/url-guard";
import { getDistrictHistory, type DistrictHistory } from "@/lib/history/record";
import type { School } from "@/lib/schools/types";
import { fail, ok, type Result } from "@/lib/weather/types";

export interface CalendarInfo {
  sources: string[];
  skipped: { date: string; reason: string }[];
  upcomingNoSchool: { date: string; reason: string }[];
}

export interface SchoolPrediction {
  school: School;
  forecast: LocationForecast;
  targetDay: string;
  targetDayLabel: string;
  hoursUntilSchool: number;
  weather: DayWeather | null;
  prediction: ClosurePrediction | null;
  official: OfficialStatus;
  calendar: CalendarInfo;
  history: DistrictHistory | null;
  notes: string[];
}

async function fetchIcs(url: string): Promise<{ date: string; summary: string }[]> {
  if (!isPublicHttpsUrl(url)) return [];
  try {
    const res = await fetchWithTimeout(url, { timeoutMs: 8_000, retries: 0, revalidate: 21_600, redirect: "error", headers: { Accept: "text/calendar" } });
    if (!res.ok) return [];
    return parseNoSchoolDays(await res.text());
  } catch {
    return [];
  }
}

export async function loadNoSchoolDays(leaid: string | null, fromDate: string, userIcs?: string | null): Promise<{ map: Map<string, string>; sources: string[] }> {
  const map = new Map<string, string>();
  const sources: string[] = ["U.S. federal holidays (days most districts close)"];
  const year = Number(fromDate.slice(0, 4));
  for (const y of [year, year + 1]) for (const h of federalHolidays(y)) if (h.schoolsTypicallyClosed) map.set(h.date, h.name);

  const entry = getRegistryEntry(leaid);
  const tasks: Promise<void>[] = [];
  if (entry?.apptegyCalendar) {
    tasks.push(
      fetchApptegyEvents(entry.apptegyCalendar, fromDate, addDays(fromDate, 45))
        .then((events) => {
          for (const d of eventsToNoSchoolDays(events)) map.set(d.date, d.summary);
          sources.push(`${entry.name} official calendar`);
        })
        .catch(() => undefined),
    );
  }
  for (const url of entry?.calendarIcs ?? []) {
    tasks.push(
      fetchIcs(url).then((days) => {
        if (!days.length) return;
        for (const d of days) map.set(d.date, d.summary);
        sources.push(`${entry!.name} calendar feed`);
      }),
    );
  }
  if (userIcs) {
    tasks.push(
      fetchIcs(userIcs).then((days) => {
        if (!days.length) return;
        for (const d of days) map.set(d.date, d.summary);
        sources.push("Your school calendar (iCal)");
      }),
    );
  }
  await Promise.all(tasks);
  return { map, sources };
}

const weekdayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

export async function getSchoolPrediction(school: School, opts: { userIcs?: string | null } = {}): Promise<Result<SchoolPrediction>> {
  const f = await getLocationForecast(school.lat, school.lon);
  if (!f.ok) return fail(f.error.code, f.error.message);
  const forecast = f.data;
  const localDate = forecast.localNow.slice(0, 10);
  const localHour = Number(forecast.localNow.slice(11, 13));

  const calendar = await loadNoSchoolDays(school.leaid, localDate, opts.userIcs);
  const target = nextSchoolDay({ localDate, localHour, noSchool: calendar.map });
  const startMs = Date.parse(`${target.date}T${String(SCHOOL_START_HOUR).padStart(2, "0")}:00:00Z`);
  const nowMs = Date.parse(`${forecast.localNow}:00Z`);
  const hoursUntilSchool = Math.max(0, Math.round((startMs - nowMs) / 3_600_000));

  const notes: string[] = [];
  const weather = closureInputsForDay(forecast.snow.hourly, target.date);
  let prediction: ClosurePrediction | null = null;
  if (weather) {
    prediction = predictClosure({
      ...weather,
      alerts: (forecast.alerts ?? []).map((a) => a.event),
      annualSnowIn: forecast.climate?.inches ?? null,
      confidence: forecast.snow.confidence.score,
    });
  } else {
    notes.push(`The forecast doesn't reach ${weekdayLabel(target.date)} morning yet — a prediction will appear as it comes into range.`);
  }
  if (school.type === "private") notes.push("Private schools often follow a nearby public district's decisions but set their own policies.");

  const [official, history] = await Promise.all([
    verifyDistrict(school.leaid, school.districtWebsite, { targetDayStartsInHours: hoursUntilSchool }),
    getDistrictHistory(school.leaid),
  ]);

  const upcoming = [...calendar.map.entries()]
    .filter(([d]) => d >= localDate && d <= addDays(localDate, 30))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, reason]) => ({ date, reason }));

  return ok({
    school,
    forecast,
    targetDay: target.date,
    targetDayLabel: weekdayLabel(target.date),
    hoursUntilSchool,
    weather,
    prediction,
    official,
    calendar: { sources: calendar.sources, skipped: target.skipped, upcomingNoSchool: upcoming.slice(0, 8) },
    history,
    notes,
  });
}
