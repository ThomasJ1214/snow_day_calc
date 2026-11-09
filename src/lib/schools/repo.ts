import "server-only";
import { edgeRepo } from "./edge-repo";
import { supabaseRepo, supabaseSchoolsEnabled } from "./supabase-repo";
import type { School, SchoolSearch } from "./types";

/**
 * Supabase (imported NCES directory with fuzzy search) when configured; otherwise — or if Supabase
 * errors or hasn't been imported yet — live NCES EDGE queries. Results are always real NCES records.
 */
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>, empty: (v: T) => boolean): Promise<{ value: T; source: string }> {
  if (supabaseSchoolsEnabled) {
    try {
      const value = await primary();
      if (!empty(value)) return { value, source: "supabase" };
    } catch (e) {
      console.warn("[schools] Supabase unavailable, falling back to NCES EDGE:", e instanceof Error ? e.message : e);
    }
  }
  return { value: await fallback(), source: "nces-edge" };
}

export const searchSchools = (p: SchoolSearch) =>
  withFallback(() => supabaseRepo.search(p), () => edgeRepo.search(p), (v) => v.length === 0);
export const getSchool = (id: string) =>
  withFallback<School | null>(() => supabaseRepo.get(id), () => edgeRepo.get(id), (v) => v == null);
export const schoolsNear = (lat: number, lon: number, radiusKm = 8, limit = 20) =>
  withFallback(() => supabaseRepo.near(lat, lon, radiusKm, limit), () => edgeRepo.near(lat, lon, radiusKm, limit), (v) => v.length === 0);
