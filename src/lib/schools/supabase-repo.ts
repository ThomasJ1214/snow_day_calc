import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";
import { rankSchools } from "./edge-repo";
import { parseSchoolId, type School, type SchoolRepo, type SchoolSearch } from "./types";

type Row = {
  id: string; type: "public" | "private"; name: string; leaid: string | null; district_name: string | null;
  street: string | null; city: string | null; state: string; zip: string | null; county: string | null;
  lat: number; lon: number; locale: string | null; website: string | null; district_website: string | null; distance_km?: number;
};

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return client;
}

const toSchool = (r: Row): School => ({
  id: r.id, type: r.type, name: r.name, leaid: r.leaid, district: r.district_name, street: r.street, city: r.city,
  state: r.state, zip: r.zip, county: r.county, lat: r.lat, lon: r.lon, locale: r.locale, website: r.website,
  districtWebsite: r.district_website, ...(r.distance_km != null ? { distanceKm: Math.round(r.distance_km * 10) / 10 } : {}),
});

export const supabaseRepo: SchoolRepo = {
  source: "supabase",
  async search({ q, state, zip, limit = 20, near }: SchoolSearch) {
    const { data, error } = await db().rpc("search_schools", { q: q ?? null, st: state ?? null, zip_code: zip ?? null, lim: 50 });
    if (error) throw new Error(error.message);
    const rows = (data as Row[]).map(toSchool);
    return rankSchools(rows, q ?? "", near).slice(0, limit);
  },
  async get(id: string) {
    if (!parseSchoolId(id)) return null;
    const { data, error } = await db().from("schools").select("*, districts(website)").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const d = data as Row & { districts: { website: string | null } | null };
    return toSchool({ ...d, district_website: d.districts?.website ?? null });
  },
  async near(lat: number, lon: number, radiusKm: number, limit: number) {
    const { data, error } = await db().rpc("schools_near", { p_lat: lat, p_lon: lon, radius_km: radiusKm, lim: limit });
    if (error) throw new Error(error.message);
    return (data as Row[]).map(toSchool);
  },
};

export const supabaseSchoolsEnabled = supabaseConfigured && process.env.SCHOOLS_SOURCE !== "nces-edge";
