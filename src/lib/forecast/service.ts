import "server-only";
import { analyzeSnow, type SnowAnalysis } from "@/lib/snow/analyze";
import { alignSeries } from "@/lib/weather/align";
import {
  DETERMINISTIC_MODELS,
  DISPLAY_ORDER,
  ENSEMBLE_MODELS,
  fetchDeterministic,
  fetchEnsemble,
  fetchModelRunTimes,
} from "@/lib/weather/open-meteo";
import { fetchNwsAlerts, fetchNwsForecast, fetchNwsGrid, fetchNwsPoint, type NwsAlert, type NwsPeriod } from "@/lib/weather/nws";
import { sumIntervals } from "@/lib/weather/ndfd";
import { annualSnowNormal, type SnowNormal } from "@/lib/climate/normals";
import { fetchHrrrPoint, type HrrrPoint } from "@/lib/weather/hrrr-direct";
import { fail, ok, type Result } from "@/lib/weather/types";

export interface SourceStatus {
  id: string;
  label: string;
  provider: string;
  kind: "deterministic" | "ensemble" | "official" | "direct";
  resolution: string | null;
  status: "ok" | "unavailable" | "not_published";
  runTime: string | null;
  note: string | null;
  total24Cm: number | null;
  total72Cm: number | null;
}

export interface LocationForecast {
  generatedAt: string;
  location: {
    lat: number;
    lon: number;
    gridLat: number;
    gridLon: number;
    elevationM: number;
    timezone: string;
    timezoneAbbr: string;
    utcOffsetSeconds: number;
    nwsOffice: string | null;
    nwsPlace: string | null;
  };
  localNow: string;
  snow: SnowAnalysis;
  alerts: NwsAlert[] | null;
  nwsPeriods: NwsPeriod[] | null;
  nwsForecastUpdated: string | null;
  ndfd: { updated: string; totalsCm: Record<"24" | "48" | "72", number | null>; ice72Mm: number | null } | null;
  climate: SnowNormal | null;
  hrrrDirect: HrrrPoint | null;
  sources: SourceStatus[];
  limitations: string[];
  warnings: string[];
}

const LIMITATIONS = [
  "Forecasts are for a model grid cell (≈2.5–25 km), not a specific street. Local terrain, lake-effect bands and coastal fronts can produce sharp differences over short distances.",
  "Low / likely / high are the 10th / 50th / 90th percentiles of ensemble members. Roughly 1 in 5 outcomes will fall outside that range.",
  "Snow totals are computed from each model's liquid precipitation and temperature-dependent snow-to-liquid ratios; actual ratios vary with the atmosphere above the surface.",
  "Lake-effect and coastal storms are represented only through the high-resolution models (HRRR, NBM).",
];

const cache = new Map<string, { at: number; value: LocationForecast }>();
const TTL_MS = 8 * 60_000;

export async function getLocationForecast(lat: number, lon: number): Promise<Result<LocationForecast>> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return ok(hit.value);

  const [det, ens, point, runTimes, hrrr] = await Promise.all([
    fetchDeterministic(lat, lon),
    fetchEnsemble(lat, lon),
    fetchNwsPoint(lat, lon),
    fetchModelRunTimes(),
    fetchHrrrPoint(lat, lon),
  ]);
  if (!det.ok) return fail(det.error.code, det.error.message);
  const d = det.data;
  const warnings: string[] = [];

  let members = ens.ok ? ens.data.members.map((m) => alignSeries(m, d.time)) : [];
  if (!ens.ok) warnings.push("Ensemble forecasts are temporarily unavailable; ranges use the spread between deterministic models.");
  members = members.filter((m) => m.precipMm.some((v) => v != null));

  const snow = analyzeSnow({
    deterministic: d.series,
    ensemble: members,
    nowIndex: d.nowIndex,
    elevationM: d.elevationM,
    primaryOrder: DISPLAY_ORDER,
    display: d.display,
    lookbackHours: 18,
  });

  let alerts: NwsAlert[] | null = null;
  let nwsPeriods: NwsPeriod[] | null = null;
  let nwsForecastUpdated: string | null = null;
  let ndfd: LocationForecast["ndfd"] = null;
  if (point.ok) {
    const [a, f, g] = await Promise.all([fetchNwsAlerts(lat, lon), fetchNwsForecast(point.data), fetchNwsGrid(point.data)]);
    if (a.ok) alerts = a.data;
    else warnings.push("NWS alerts could not be retrieved right now.");
    if (f.ok) {
      nwsPeriods = f.data.periods;
      nwsForecastUpdated = f.data.updated;
    }
    if (g.ok) {
      const startMs = Date.now() - (Date.now() % 3_600_000);
      const mm = (h: number) => sumIntervals(g.data.snowfallAmount, startMs, h);
      const toCm = (v: number | null) => (v == null ? null : Math.round(v) / 10);
      const ice = sumIntervals(g.data.iceAccumulation, startMs, 72);
      ndfd = { updated: g.data.updateTime, totalsCm: { "24": toCm(mm(24)), "48": toCm(mm(48)), "72": toCm(mm(72)) }, ice72Mm: ice };
    }
  } else {
    warnings.push("This point is outside National Weather Service forecast coverage or NWS is unavailable.");
  }

  const sources: SourceStatus[] = [];
  for (const m of DETERMINISTIC_MODELS) {
    const t = snow.modelTotals[m.id];
    const rt = runTimes[m.id];
    sources.push({
      id: m.id,
      label: m.label,
      provider: m.provider,
      kind: "deterministic",
      resolution: m.resolution,
      status: t ? "ok" : "unavailable",
      runTime: rt?.initTime ?? null,
      note: !t
        ? "No data for this location (outside model domain)"
        : t.horizonHours < 72
          ? `Forecast extends ${t.horizonHours} h`
          : rt
            ? null
            : "Run time not published by provider",
      total24Cm: t?.total24 ?? null,
      total72Cm: t?.total72 ?? null,
    });
  }
  for (const m of ENSEMBLE_MODELS) {
    const n = ens.ok ? (ens.data.byModel[m.suffix] ?? 0) : 0;
    sources.push({
      id: m.suffix,
      label: m.label,
      provider: m.suffix.startsWith("ncep") ? "NOAA/NCEP" : "ECMWF",
      kind: "ensemble",
      resolution: "25 km",
      status: n > 0 ? "ok" : "unavailable",
      runTime: runTimes[m.suffix]?.initTime ?? null,
      note: n > 0 ? `${n} members used for percentiles` : "Unavailable",
      total24Cm: null,
      total72Cm: null,
    });
  }
  sources.push({
    id: "nws_ndfd",
    label: "NWS official forecast grid (NDFD)",
    provider: point.ok ? `NWS ${point.data.office}` : "NOAA/NWS",
    kind: "official",
    resolution: "2.5 km",
    status: ndfd ? "ok" : "unavailable",
    runTime: ndfd?.updated ?? null,
    note: ndfd ? "Human forecaster snowfall; shown for comparison" : "Not available for this point",
    total24Cm: ndfd?.totalsCm["24"] ?? null,
    total72Cm: ndfd?.totalsCm["72"] ?? null,
  });
  if (hrrr.ok) {
    sources.push({
      id: "hrrr_grib2",
      label: "HRRR — direct NOAA GRIB2",
      provider: "NOAA/NCEP (noaa-hrrr-bdp-pds)",
      kind: "direct",
      resolution: "3 km",
      status: hrrr.data.asnowCm[18] != null ? "ok" : "unavailable",
      runTime: hrrr.data.runTime,
      note: `Decoded from raw GRIB2 (run ${hrrr.data.run}); 0–18 h accumulated snowfall`,
      total24Cm: null,
      total72Cm: null,
    });
  } else {
    sources.push({
      id: "hrrr_grib2",
      label: "HRRR — direct NOAA GRIB2",
      provider: "NOAA/NCEP",
      kind: "direct",
      resolution: "3 km",
      status: "unavailable",
      runTime: null,
      note: hrrr.error.message,
      total24Cm: null,
      total72Cm: null,
    });
  }
  sources.push({
    id: "rrfs",
    label: "RRFS (Rapid Refresh Forecast System)",
    provider: "NOAA/NCEP",
    kind: "direct",
    resolution: "3 km",
    status: hrrr.ok && hrrr.data.rrfsStatus === "available" ? "ok" : "not_published",
    runTime: null,
    note: "NOAA has not yet published operational RRFS output on its open-data bucket; HRRR is used for high-resolution guidance.",
    total24Cm: null,
    total72Cm: null,
  });

  const value: LocationForecast = {
    generatedAt: new Date().toISOString(),
    location: {
      lat,
      lon,
      gridLat: d.gridLat,
      gridLon: d.gridLon,
      elevationM: d.elevationM,
      timezone: d.timezone,
      timezoneAbbr: d.timezoneAbbr,
      utcOffsetSeconds: d.utcOffsetSeconds,
      nwsOffice: point.ok ? point.data.office : null,
      nwsPlace: point.ok && point.data.city ? `${point.data.city}, ${point.data.state}` : null,
    },
    localNow: d.time[d.nowIndex] ?? d.time[0],
    snow,
    alerts,
    nwsPeriods,
    nwsForecastUpdated,
    ndfd,
    climate: annualSnowNormal(lat, lon),
    hrrrDirect: hrrr.ok ? hrrr.data : null,
    sources,
    limitations: LIMITATIONS,
    warnings,
  };
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return ok(value);
}
