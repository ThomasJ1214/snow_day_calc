import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/national/cities";
import { encodeSlug } from "@/lib/geo/slug";
import { schoolsNear } from "@/lib/schools/repo";

export const revalidate = 86_400;

const MONTVILLE = { lat: 40.9154, lon: -74.3638 };

/**
 * Core pages, a forecast page for every reference city, and every school within ~25 km of
 * Montville, NJ (the primary audience) so Google can find the pages local families search for.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: `${site}/`, changeFrequency: "hourly", priority: 1, lastModified: now },
    { url: `${site}/school/pub-341065004332`, changeFrequency: "hourly", priority: 0.9, lastModified: now },
    { url: `${site}/forecast/${encodeSlug({ name: "Montville, NJ", ...MONTVILLE })}`, changeFrequency: "hourly", priority: 0.9, lastModified: now },
    { url: `${site}/national`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${site}/methodology`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/compare`, changeFrequency: "monthly", priority: 0.3 },
  ];
  const cities: MetadataRoute.Sitemap = CITIES.map((c) => ({
    url: `${site}/forecast/${encodeSlug({ name: `${c.name}, ${c.state}`, lat: c.lat, lon: c.lon })}`,
    changeFrequency: "hourly",
    priority: 0.6,
  }));
  let schools: MetadataRoute.Sitemap = [];
  try {
    const { value } = await schoolsNear(MONTVILLE.lat, MONTVILLE.lon, 25, 300);
    schools = value.map((s) => ({ url: `${site}/school/${s.id}`, changeFrequency: "hourly", priority: 0.7 }));
  } catch {
    /* directory unavailable at build time: core and city pages still list */
  }
  const seen = new Set<string>();
  return [...core, ...cities, ...schools].filter((e) => !seen.has(e.url) && seen.add(e.url));
}
