import "server-only";
import { fetchJson } from "@/lib/server/http";
import { fail, ok, type HourlySeries, type Result } from "./types";

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  resolution: string;
  /** Open-Meteo metadata folder for run times (null when not published). */
  meta: string | null;
}

export const DETERMINISTIC_MODELS: ModelInfo[] = [
  { id: "ncep_nbm_conus", label: "National Blend of Models", provider: "NOAA/NWS", resolution: "2.5 km", meta: "ncep_nbm_conus" },
  { id: "gfs_hrrr", label: "HRRR", provider: "NOAA/NCEP", resolution: "3 km", meta: "ncep_hrrr_conus" },
  { id: "gfs_seamless", label: "GFS", provider: "NOAA/NCEP", resolution: "13–25 km", meta: null },
  { id: "ecmwf_ifs025", label: "ECMWF IFS", provider: "ECMWF", resolution: "25 km", meta: "ecmwf_ifs025" },
  { id: "gem_seamless", label: "GEM", provider: "Environment Canada", resolution: "2.5–15 km", meta: null },
  { id: "icon_seamless", label: "ICON", provider: "DWD (Germany)", resolution: "2–13 km", meta: "dwd_icon" },
];
export const ENSEMBLE_MODELS = [
  { id: "gfs025", suffix: "ncep_gefs025", label: "NOAA GEFS (31 members)", meta: "ncep_gefs05" },
  { id: "ecmwf_ifs025", suffix: "ecmwf_ifs025_ensemble", label: "ECMWF ENS (51 members)", meta: "ecmwf_ifs025_ensemble" },
];
/** Best-first preference for weather display fields (temperature, wind, visibility). */
export const DISPLAY_ORDER = ["ncep_nbm_conus", "gfs_hrrr", "gfs_seamless", "ecmwf_ifs025", "gem_seamless", "icon_seamless"];

const HOURLY = [
  "precipitation",
  "snowfall",
  "temperature_2m",
  "relative_humidity_2m",
  "wind_gusts_10m",
  "wind_speed_10m",
  "visibility",
  "weather_code",
  "freezing_level_height",
];
const FIELD: Record<string, keyof HourlySeries> = {
  precipitation: "precipMm",
  snowfall: "snowfallCm",
  temperature_2m: "tempC",
  relative_humidity_2m: "rh",
  wind_gusts_10m: "gustKmh",
  wind_speed_10m: "windKmh",
  visibility: "visibilityM",
  weather_code: "weatherCode",
  freezing_level_height: "freezingLevelM",
};

interface OMResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;
  hourly: Record<string, (number | null)[] | string[]>;
}

function emptySeries(time: string[]): HourlySeries {
  const nulls = () => time.map(() => null);
  return {
    time,
    precipMm: nulls(),
    snowfallCm: nulls(),
    tempC: nulls(),
    rh: nulls(),
    gustKmh: nulls(),
    windKmh: nulls(),
    visibilityM: nulls(),
    weatherCode: nulls(),
    freezingLevelM: nulls(),
  };
}

/** Local "YYYY-MM-DDTHH:00" for the current hour at a fixed UTC offset. */
export function localHourString(utcOffsetSeconds: number, now = Date.now()): string {
  return new Date(now + utcOffsetSeconds * 1000).toISOString().slice(0, 13) + ":00";
}

export function nowIndexFor(time: string[], utcOffsetSeconds: number, now = Date.now()): number {
  const i = time.indexOf(localHourString(utcOffsetSeconds, now));
  return i >= 0 ? i : 0;
}

export interface DeterministicForecast {
  timezone: string;
  timezoneAbbr: string;
  utcOffsetSeconds: number;
  elevationM: number;
  gridLat: number;
  gridLon: number;
  time: string[];
  nowIndex: number;
  series: Record<string, HourlySeries>;
  /** Field-wise composite (best available model per field) used for temperature/wind/visibility display. */
  display: HourlySeries;
  missingModels: string[];
}

export async function fetchDeterministic(lat: number, lon: number): Promise<Result<DeterministicForecast>> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=${HOURLY.join(",")}&models=${DETERMINISTIC_MODELS.map((m) => m.id).join(",")}` +
    `&past_days=1&forecast_days=4&timezone=auto`;
  try {
    const d = await fetchJson<OMResponse>(url, { revalidate: 600, timeoutMs: 15_000 });
    const time = d.hourly.time as string[];
    const series: Record<string, HourlySeries> = {};
    const missingModels: string[] = [];
    for (const m of DETERMINISTIC_MODELS) {
      const s = emptySeries(time);
      for (const v of HOURLY) {
        const arr = d.hourly[`${v}_${m.id}`] as (number | null)[] | undefined;
        if (arr) (s[FIELD[v]] as (number | null)[]) = arr;
      }
      const hasData = s.precipMm.some((x) => x != null) && s.tempC.some((x) => x != null);
      if (hasData) series[m.id] = s;
      else missingModels.push(m.id);
    }
    const display = emptySeries(time);
    for (const v of HOURLY) {
      const key = FIELD[v];
      (display[key] as (number | null)[]) = time.map((_, i) => {
        for (const id of DISPLAY_ORDER) {
          const val = series[id]?.[key]?.[i] as number | null | undefined;
          if (val != null) return val;
        }
        return null;
      });
    }
    return ok({
      timezone: d.timezone,
      timezoneAbbr: d.timezone_abbreviation,
      utcOffsetSeconds: d.utc_offset_seconds,
      elevationM: d.elevation,
      gridLat: d.latitude,
      gridLon: d.longitude,
      time,
      nowIndex: nowIndexFor(time, d.utc_offset_seconds),
      series,
      display,
      missingModels,
    });
  } catch (e) {
    return fail("forecast_unavailable", `Open-Meteo forecast request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export interface EnsembleForecast {
  members: HourlySeries[];
  byModel: Record<string, number>;
  time: string[];
}

export async function fetchEnsemble(lat: number, lon: number): Promise<Result<EnsembleForecast>> {
  const vars = ["precipitation", "snowfall", "temperature_2m", "relative_humidity_2m", "wind_gusts_10m"];
  const url =
    `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat}&longitude=${lon}` +
    `&hourly=${vars.join(",")}&models=${ENSEMBLE_MODELS.map((m) => m.id).join(",")}&past_days=1&forecast_days=4&timezone=auto`;
  try {
    const d = await fetchJson<OMResponse>(url, { revalidate: 900, timeoutMs: 20_000 });
    const time = d.hourly.time as string[];
    const groups = new Map<string, HourlySeries>();
    const byModel: Record<string, number> = {};
    for (const [key, arr] of Object.entries(d.hourly)) {
      if (key === "time") continue;
      const model = ENSEMBLE_MODELS.find((m) => key.endsWith(`_${m.suffix}`));
      if (!model) continue;
      const head = key.slice(0, key.length - model.suffix.length - 1);
      const mm = head.match(/^(.*)_member(\d+)$/);
      const variable = mm ? mm[1] : head;
      const member = mm ? mm[2] : "00";
      const gid = `${model.suffix}#${member}`;
      if (!groups.has(gid)) groups.set(gid, emptySeries(time));
      const field = FIELD[variable];
      if (field) (groups.get(gid)![field] as (number | null)[]) = arr as (number | null)[];
    }
    const members: HourlySeries[] = [];
    for (const [gid, s] of groups) {
      if (!s.precipMm.some((x) => x != null)) continue;
      members.push(s);
      const suffix = gid.split("#")[0];
      byModel[suffix] = (byModel[suffix] ?? 0) + 1;
    }
    return ok({ members, byModel, time });
  } catch (e) {
    return fail("ensemble_unavailable", `Open-Meteo ensemble request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Latest run initialisation time per model (ISO), where Open-Meteo publishes it. */
export async function fetchModelRunTimes(): Promise<Record<string, { initTime: string; availableTime: string } | null>> {
  const metas = [...DETERMINISTIC_MODELS.map((m) => [m.id, m.meta] as const), ...ENSEMBLE_MODELS.map((m) => [m.suffix, m.meta] as const)];
  const out: Record<string, { initTime: string; availableTime: string } | null> = {};
  await Promise.all(
    metas.map(async ([id, meta]) => {
      if (!meta) {
        out[id] = null;
        return;
      }
      try {
        const m = await fetchJson<{ last_run_initialisation_time: number; last_run_availability_time: number }>(
          `https://api.open-meteo.com/data/${meta}/static/meta.json`,
          { revalidate: 600, timeoutMs: 6_000, retries: 0 },
        );
        out[id] = {
          initTime: new Date(m.last_run_initialisation_time * 1000).toISOString(),
          availableTime: new Date(m.last_run_availability_time * 1000).toISOString(),
        };
      } catch {
        out[id] = null;
      }
    }),
  );
  return out;
}
