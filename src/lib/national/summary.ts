import "server-only";
import { fetchJson } from "@/lib/server/http";
import { omHost } from "@/lib/weather/open-meteo";
import { CITIES, type City, type Region } from "./cities";

export interface CitySnow extends City {
  /** Next-3-local-day snowfall totals (cm): today, tomorrow, day after (NBM/GFS "best match"). */
  daysCm: [number | null, number | null, number | null];
  total72Cm: number | null;
  tempMinC: number | null;
}

export interface NationalSummary {
  generatedAt: string;
  cities: CitySnow[];
  regions: { region: Region; maxCm: number; snowyCities: number; leader: string | null }[];
  model: string;
}

let cache: { at: number; value: NationalSummary } | null = null;

/** One multi-location request for all reference cities (cached 30 min). */
export async function getNationalSummary(): Promise<NationalSummary> {
  if (cache && Date.now() - cache.at < 30 * 60_000) return cache.value;
  const lats = CITIES.map((c) => c.lat).join(",");
  const lons = CITIES.map((c) => c.lon).join(",");
  const key = process.env.OPEN_METEO_API_KEY ? `&apikey=${process.env.OPEN_METEO_API_KEY}` : "";
  const url = `${omHost("api")}/v1/forecast?latitude=${lats}&longitude=${lons}&daily=snowfall_sum,temperature_2m_min&forecast_days=3&timezone=auto${key}`;
  const data = await fetchJson<{ daily: { snowfall_sum: (number | null)[]; temperature_2m_min: (number | null)[] } }[]>(url, {
    revalidate: 1800,
    timeoutMs: 20_000,
  });
  const cities: CitySnow[] = CITIES.map((c, i) => {
    const d = data[i]?.daily;
    const days = [0, 1, 2].map((k) => d?.snowfall_sum?.[k] ?? null) as CitySnow["daysCm"];
    const known = days.filter((v): v is number => v != null);
    const total = known.length === 3 ? Math.round(known.reduce((s, v) => s + v, 0) * 10) / 10 : null;
    return { ...c, daysCm: days, total72Cm: total, tempMinC: d?.temperature_2m_min?.[0] ?? null };
  });
  const regions = [...new Set(CITIES.map((c) => c.region))].map((region) => {
    const list = cities.filter((c) => c.region === region);
    const top = [...list].sort((a, b) => (b.total72Cm ?? 0) - (a.total72Cm ?? 0))[0];
    return {
      region,
      maxCm: top?.total72Cm ?? 0,
      snowyCities: list.filter((c) => (c.total72Cm ?? 0) >= 2.5).length,
      leader: top && (top.total72Cm ?? 0) > 0 ? `${top.name}, ${top.state}` : null,
    };
  });
  const value = { generatedAt: new Date().toISOString(), cities, regions, model: "Open-Meteo best match (NOAA NBM/HRRR/GFS over the U.S.)" };
  cache = { at: Date.now(), value };
  return value;
}
