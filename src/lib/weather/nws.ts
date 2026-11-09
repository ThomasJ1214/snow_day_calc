import "server-only";
import { fetchJson } from "@/lib/server/http";
import { fail, ok, type Result } from "./types";
import type { NdfdValue } from "./ndfd";

const NWS = "https://api.weather.gov";
const GEO = { Accept: "application/geo+json" };

export interface NwsPoint {
  office: string;
  gridX: number;
  gridY: number;
  forecastUrl: string;
  forecastGridDataUrl: string;
  timeZone: string;
  city: string | null;
  state: string | null;
  radarStation: string | null;
}

export interface NwsAlert {
  id: string;
  event: string;
  headline: string | null;
  severity: string;
  urgency: string;
  onset: string | null;
  ends: string | null;
  expires: string | null;
  description: string;
  instruction: string | null;
  senderName: string;
  areaDesc: string;
}

export interface NwsPeriod {
  name: string;
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation: number | null;
}

export interface NwsGrid {
  updateTime: string;
  snowfallAmount: NdfdValue[];
  iceAccumulation: NdfdValue[];
}

const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

export async function fetchNwsPoint(lat: number, lon: number): Promise<Result<NwsPoint>> {
  try {
    const d = await fetchJson<{ properties: Record<string, any> }>(`${NWS}/points/${r4(lat)},${r4(lon)}`, { revalidate: 86_400, headers: GEO }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const p = d.properties;
    return ok({
      office: p.gridId,
      gridX: p.gridX,
      gridY: p.gridY,
      forecastUrl: p.forecast,
      forecastGridDataUrl: p.forecastGridData,
      timeZone: p.timeZone,
      city: p.relativeLocation?.properties?.city ?? null,
      state: p.relativeLocation?.properties?.state ?? null,
      radarStation: p.radarStation ?? null,
    });
  } catch (e) {
    return fail("nws_point_unavailable", `NWS does not cover this point or is unavailable (${e instanceof Error ? e.message : e})`);
  }
}

export async function fetchNwsAlerts(lat: number, lon: number): Promise<Result<NwsAlert[]>> {
  try {
    const d = await fetchJson<{ features: { id: string; properties: Record<string, any> }[] }>( // eslint-disable-line @typescript-eslint/no-explicit-any
      `${NWS}/alerts/active?point=${r4(lat)},${r4(lon)}`,
      { revalidate: 300, headers: GEO },
    );
    return ok(
      d.features.map((f) => ({
        id: f.id,
        event: f.properties.event,
        headline: f.properties.headline ?? null,
        severity: f.properties.severity,
        urgency: f.properties.urgency,
        onset: f.properties.onset ?? f.properties.effective ?? null,
        ends: f.properties.ends ?? null,
        expires: f.properties.expires ?? null,
        description: f.properties.description ?? "",
        instruction: f.properties.instruction ?? null,
        senderName: f.properties.senderName ?? "National Weather Service",
        areaDesc: f.properties.areaDesc ?? "",
      })),
    );
  } catch (e) {
    return fail("nws_alerts_unavailable", `NWS alerts unavailable (${e instanceof Error ? e.message : e})`);
  }
}

export async function fetchNwsForecast(point: NwsPoint): Promise<Result<{ updated: string; periods: NwsPeriod[] }>> {
  try {
    const d = await fetchJson<{ properties: { updateTime?: string; updated?: string; periods: any[] } }>(point.forecastUrl, { revalidate: 900, headers: GEO }); // eslint-disable-line @typescript-eslint/no-explicit-any
    return ok({
      updated: d.properties.updateTime ?? d.properties.updated ?? "",
      periods: d.properties.periods.slice(0, 8).map((p) => ({
        name: p.name,
        startTime: p.startTime,
        isDaytime: p.isDaytime,
        temperature: p.temperature,
        temperatureUnit: p.temperatureUnit,
        windSpeed: p.windSpeed,
        shortForecast: p.shortForecast,
        detailedForecast: p.detailedForecast,
        probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value ?? null,
      })),
    });
  } catch (e) {
    return fail("nws_forecast_unavailable", `NWS forecast unavailable (${e instanceof Error ? e.message : e})`);
  }
}

export async function fetchNwsGrid(point: NwsPoint): Promise<Result<NwsGrid>> {
  try {
    const d = await fetchJson<{ properties: Record<string, any> }>(point.forecastGridDataUrl, { revalidate: 900, headers: GEO, timeoutMs: 15_000 }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const p = d.properties;
    return ok({
      updateTime: p.updateTime,
      snowfallAmount: p.snowfallAmount?.values ?? [],
      iceAccumulation: p.iceAccumulation?.values ?? [],
    });
  } catch (e) {
    return fail("nws_grid_unavailable", `NWS gridded forecast unavailable (${e instanceof Error ? e.message : e})`);
  }
}
