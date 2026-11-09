import "server-only";
import { fetchJson } from "@/lib/server/http";
import { fail, ok, type Result } from "@/lib/weather/types";
import { detectQueryKind, parseCityState, stateAbbr, STATE_NAMES } from "./query";

export interface Place {
  name: string;
  detail: string;
  lat: number;
  lon: number;
  state: string | null;
  kind: "zip" | "city" | "address" | "coords";
  zip?: string;
}

const US_STATES = new Set(Object.keys(STATE_NAMES));

async function byZip(zip: string): Promise<Place[]> {
  const z = zip.slice(0, 5);
  try {
    const d = await fetchJson<{ places: { "place name": string; latitude: string; longitude: string; "state abbreviation": string }[] }>(
      `https://api.zippopotam.us/us/${z}`,
      { revalidate: 2_592_000, retries: 0 },
    );
    return d.places.map((p) => ({
      name: `${p["place name"]}, ${p["state abbreviation"]}`,
      detail: `ZIP ${z}`,
      lat: Number(p.latitude),
      lon: Number(p.longitude),
      state: p["state abbreviation"],
      kind: "zip" as const,
      zip: z,
    }));
  } catch {
    return [];
  }
}

async function byCity(q: string): Promise<Place[]> {
  const { city, state } = parseCityState(q);
  if (city.length < 2) return [];
  const d = await fetchJson<{ results?: { name: string; latitude: number; longitude: number; admin1?: string; admin2?: string; population?: number; country_code: string; postcodes?: string[] }[] }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=20&countryCode=US&language=en`,
    { revalidate: 604_800 },
  );
  return (d.results ?? [])
    .map((r) => ({ r, st: stateAbbr(r.admin1) }))
    .filter(({ r, st }) => r.country_code === "US" && st && US_STATES.has(st) && (!state || st === state))
    .sort((a, b) => (b.r.population ?? 0) - (a.r.population ?? 0))
    .slice(0, 8)
    .map(({ r, st }) => ({
      name: `${r.name}, ${st}`,
      detail: [r.admin2, STATE_NAMES[st!]].filter(Boolean).join(", "),
      lat: r.latitude,
      lon: r.longitude,
      state: st,
      kind: "city" as const,
    }));
}

async function byAddress(q: string): Promise<Place[]> {
  const d = await fetchJson<{ result: { addressMatches: { matchedAddress: string; coordinates: { x: number; y: number }; addressComponents: { state: string; zip: string } }[] } }>(
    `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`,
    { revalidate: 2_592_000, timeoutMs: 15_000 },
  );
  return d.result.addressMatches.slice(0, 5).map((m) => ({
    name: m.matchedAddress.replace(/,\s*\d{5}(-\d{4})?$/, ""),
    detail: "Street address (U.S. Census geocoder)",
    lat: m.coordinates.y,
    lon: m.coordinates.x,
    state: m.addressComponents.state,
    kind: "address" as const,
    zip: m.addressComponents.zip,
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<Place> {
  const fallback: Place = { name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, detail: "Selected point", lat, lon, state: null, kind: "coords" };
  try {
    const d = await fetchJson<{ result: { geographies: Record<string, { NAME?: string; BASENAME?: string; STUSAB?: string }[]> } }>(
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Incorporated%20Places,Census%20Designated%20Places,Counties,States&format=json`,
      { revalidate: 2_592_000, timeoutMs: 12_000 },
    );
    const g = d.result.geographies;
    const st = g.States?.[0]?.STUSAB ?? stateAbbr(g.States?.[0]?.NAME);
    if (!st) return fallback;
    const place = g["Incorporated Places"]?.[0]?.BASENAME ?? g["Census Designated Places"]?.[0]?.BASENAME;
    const county = g.Counties?.[0]?.NAME;
    return { name: place ? `${place}, ${st}` : `${county ?? "Unnamed area"}, ${st}`, detail: county ?? STATE_NAMES[st] ?? "", lat, lon, state: st, kind: "coords" };
  } catch {
    return fallback;
  }
}

export async function geocode(raw: string): Promise<Result<Place[]>> {
  const q = raw.trim();
  const kind = detectQueryKind(q);
  try {
    switch (kind) {
      case "invalid":
        return fail("invalid_query", "Enter a ZIP code, city and state, or street address.");
      case "zip":
        return ok(await byZip(q));
      case "coords": {
        const [lat, lon] = q.split(",").map((s) => Number(s.trim()));
        return ok([await reverseGeocode(lat, lon)]);
      }
      case "address": {
        const a = await byAddress(q);
        return ok(a.length ? a : await byCity(q.replace(/^\d+\s+/, "")));
      }
      case "city":
        return ok(await byCity(q));
    }
  } catch (e) {
    return fail("geocoder_unavailable", `Location search is temporarily unavailable (${e instanceof Error ? e.message : e}).`);
  }
}
