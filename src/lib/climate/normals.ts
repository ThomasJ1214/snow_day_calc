import data from "./snow-normals.json";
import { haversineKm } from "@/lib/geo/distance";

type Row = [number, number, number, string];
const stations = (data as unknown as { stations: Row[] }).stations;

export interface SnowNormal {
  inches: number;
  method: "idw" | "nearest";
  stations: { name: string; distanceKm: number; inches: number }[];
  source: string;
}

/**
 * NOAA 1991–2020 mean annual snowfall near a point: inverse-distance-weighted mean of up to 4
 * stations within 60 km, else the nearest station within 120 km, else null.
 */
export function annualSnowNormal(lat: number, lon: number): SnowNormal | null {
  const near: { row: Row; d: number }[] = [];
  for (const row of stations) {
    if (Math.abs(row[0] - lat) > 1.2 || Math.abs(row[1] - lon) > 1.8) continue;
    const d = haversineKm(lat, lon, row[0], row[1]);
    if (d <= 120) near.push({ row, d });
  }
  if (near.length === 0) return null;
  near.sort((a, b) => a.d - b.d);
  const within = near.filter((n) => n.d <= 60).slice(0, 4);
  const source = "NOAA NCEI U.S. Climate Normals 1991–2020";
  const fmt = (n: { row: Row; d: number }) => ({ name: n.row[3], distanceKm: Math.round(n.d), inches: n.row[2] });
  if (within.length === 0) {
    return { inches: near[0].row[2], method: "nearest", stations: [fmt(near[0])], source };
  }
  let wSum = 0;
  let vSum = 0;
  for (const n of within) {
    const w = 1 / Math.max(1, n.d) ** 2;
    wSum += w;
    vSum += w * n.row[2];
  }
  return { inches: Math.round((vSum / wSum) * 10) / 10, method: "idw", stations: within.map(fmt), source };
}
