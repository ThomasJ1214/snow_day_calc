import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return ["", "/national", "/compare", "/methodology", "/forecast/montville-nj--40.9154_-74.3638", "/school/pub-341065004332"].map((p) => ({ url: `${site}${p}`, changeFrequency: "hourly" }));
}
