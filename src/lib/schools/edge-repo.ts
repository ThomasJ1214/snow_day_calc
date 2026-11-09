import "server-only";
import { fetchJson } from "@/lib/server/http";
import districts from "./districts.json";
import { parseSchoolId, type School, type SchoolRepo, type SchoolSearch } from "./types";

const BASE = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services";
const PUBLIC = `${BASE}/Public_School_Locations_Current/FeatureServer/0/query`;
const PRIVATE = `${BASE}/Private_School_Locations_Current/FeatureServer/0/query`;
const DISTRICTS = `${BASE}/School_District_Characteristics_Current/FeatureServer/0/query`;
const PUB_FIELDS = "NCESSCH,LEAID,NAME,STREET,CITY,STATE,ZIP,NMCNTY,LOCALE,LAT,LON";
const PVT_FIELDS = "PPIN,NAME,STREET,CITY,STATE,ZIP,NMCNTY,LOCALE,LAT,LON";
const index = districts as unknown as Record<string, [string, string | null]>;

type Attrs = Record<string, string | number | null>;

/** Escapes user text for an ArcGIS SQL LIKE clause (quotes doubled, wildcards stripped). */
export function sqlText(v: string): string {
  return v.replace(/[%_[\]\\]/g, " ").replace(/'/g, "''").replace(/\s+/g, " ").trim().toUpperCase();
}

const STOP = new Set(["THE", "OF", "AND", "AT", "FOR", "A"]);

/** Every significant word must appear in the name (any order): "montville high" matches "Montville Township High School". */
export function nameClause(text: string): string {
  const words = sqlText(text)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 6);
  if (!words.length) return "1=0";
  return `(${words.map((w) => `UPPER(NAME) LIKE '%${w}%'`).join(" AND ")})`;
}

/** Name-prefix matches first, then proximity to the user (when known), then alphabetical. */
export function rankSchools<T extends { name: string; lat: number; lon: number }>(list: T[], q: string, near?: { lat: number; lon: number }): T[] {
  const t = q.toLowerCase().trim();
  const textRank = (s: T) => (t && s.name.toLowerCase().startsWith(t) ? 0 : t && s.name.toLowerCase().includes(t) ? 1 : 2);
  const dist = (s: T) => (near ? Math.hypot(s.lat - near.lat, (s.lon - near.lon) * Math.cos((near.lat * Math.PI) / 180)) : 0);
  return [...list].sort((a, b) => {
    if (near) {
      const da = dist(a) < 0.5 ? 0 : 1; // within ~50 km
      const db = dist(b) < 0.5 ? 0 : 1;
      if (da !== db) return da - db;
    }
    return textRank(a) - textRank(b) || dist(a) - dist(b) || a.name.localeCompare(b.name);
  });
}

const title = (s: string | null) =>
  s ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Of|And|The|For|At)\b/g, (w) => w.toLowerCase()) : s;

function toSchool(a: Attrs, type: "public" | "private"): School {
  const leaid = type === "public" ? String(a.LEAID ?? "") || null : null;
  const d = leaid ? index[leaid] : undefined;
  return {
    id: type === "public" ? `pub-${a.NCESSCH}` : `pvt-${a.PPIN}`,
    type,
    name: title(String(a.NAME ?? "")) ?? "",
    leaid,
    district: d?.[0] ?? null,
    street: title(a.STREET as string | null),
    city: title(a.CITY as string | null),
    state: String(a.STATE ?? ""),
    zip: (a.ZIP as string | null) ?? null,
    county: (a.NMCNTY as string | null) ?? null,
    lat: Number(a.LAT),
    lon: Number(a.LON),
    locale: a.LOCALE != null ? String(a.LOCALE) : null,
    website: null,
    districtWebsite: d?.[1] ?? null,
  };
}

async function query(url: string, params: Record<string, string>): Promise<Attrs[]> {
  const qs = new URLSearchParams({ f: "json", returnGeometry: "false", ...params });
  const d = await fetchJson<{ features?: { attributes: Attrs }[]; error?: { message: string } }>(`${url}?${qs}`, {
    revalidate: 86_400,
    timeoutMs: 12_000,
  });
  if (d.error) throw new Error(d.error.message);
  return (d.features ?? []).map((f) => f.attributes);
}

export const edgeRepo: SchoolRepo = {
  source: "nces-edge",

  async search({ q, state, zip, limit = 20, near }: SchoolSearch) {
    const clauses: string[] = [];
    const st = state && /^[A-Z]{2}$/.test(state) ? state : null;
    if (st) clauses.push(`STATE='${st}'`);
    if (zip && /^\d{5}$/.test(zip)) clauses.push(`ZIP='${zip}'`);
    const text = q ? sqlText(q) : "";
    let leaids: string[] = [];
    if (text.length >= 3) {
      const dWhere = [`UPPER(LEA_NAME) LIKE '%${text}%'`, ...(st ? [`LSTATE='${st}'`] : [])].join(" AND ");
      leaids = (await query(DISTRICTS, { where: dWhere, outFields: "LEAID", resultRecordCount: "10" }).catch(() => []))
        .map((a) => String(a.LEAID))
        .filter((id) => /^\d{7}$/.test(id));
    }
    const textClause = text
      ? `(${nameClause(text)} OR UPPER(CITY) = '${text}'${leaids.length ? ` OR LEAID IN (${leaids.map((l) => `'${l}'`).join(",")})` : ""})`
      : null;
    if (!textClause && clauses.length === 0) return [];
    const pubWhere = [...clauses, ...(textClause ? [textClause] : [])].join(" AND ");
    const pvtWhere = [...clauses, ...(text ? [`(${nameClause(text)} OR UPPER(CITY) = '${text}')`] : [])].join(" AND ");
    const n = "50";
    const [pub, pvt] = await Promise.all([
      query(PUBLIC, { where: pubWhere, outFields: PUB_FIELDS, resultRecordCount: n, orderByFields: "NAME" }),
      query(PRIVATE, { where: pvtWhere, outFields: PVT_FIELDS, resultRecordCount: n, orderByFields: "NAME" }).catch(() => []),
    ]);
    const all = [...pub.map((a) => toSchool(a, "public")), ...pvt.map((a) => toSchool(a, "private"))];
    return rankSchools(all, q ?? "", near).slice(0, limit);
  },

  async get(id: string) {
    const p = parseSchoolId(id);
    if (!p) return null;
    const rows =
      p.kind === "public"
        ? await query(PUBLIC, { where: `NCESSCH='${p.code}'`, outFields: PUB_FIELDS })
        : await query(PRIVATE, { where: `PPIN='${sqlText(p.code)}'`, outFields: PVT_FIELDS });
    return rows[0] ? toSchool(rows[0], p.kind) : null;
  },

  async near(lat: number, lon: number, radiusKm: number, limit: number) {
    const geo = {
      geometry: `${lon},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      distance: String(radiusKm),
      units: "esriSRUnit_Kilometer",
      resultRecordCount: "200",
    };
    const [pub, pvt] = await Promise.all([
      query(PUBLIC, { ...geo, where: "1=1", outFields: PUB_FIELDS }),
      query(PRIVATE, { ...geo, where: "1=1", outFields: PVT_FIELDS }).catch(() => []),
    ]);
    const toRad = (d: number) => (d * Math.PI) / 180;
    return [...pub.map((a) => toSchool(a, "public")), ...pvt.map((a) => toSchool(a, "private"))]
      .map((s) => {
        const dLat = toRad(s.lat - lat);
        const dLon = toRad(s.lon - lon);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(s.lat)) * Math.sin(dLon / 2) ** 2;
        return { ...s, distanceKm: Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10 };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  },
};
