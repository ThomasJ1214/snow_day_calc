"use client";
import type { Favorite } from "./storage";
import { encodeSlug } from "@/lib/geo/slug";

interface ServerSaved {
  locations: { id: string; name: string; lat: number; lon: number }[];
  schools: { school_id: string; school_name: string; leaid: string | null; lat: number; lon: number }[];
}

/** Uploads this device's favorites, then returns the account's full list (union of both). */
export async function syncFavorites(local: Favorite[]): Promise<Favorite[] | null> {
  if (local.length) {
    await fetch("/api/me/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: local }) }).catch(() => null);
  }
  const res = await fetch("/api/me/saved").catch(() => null);
  if (!res?.ok) return null;
  const d = (await res.json()) as ServerSaved;
  return [
    ...d.schools.map((s) => ({ type: "school" as const, schoolId: s.school_id, name: s.school_name, leaid: s.leaid, lat: s.lat, lon: s.lon })),
    ...d.locations.map((l) => ({ type: "location" as const, name: l.name, lat: l.lat, lon: l.lon, slug: encodeSlug(l) })),
  ];
}
