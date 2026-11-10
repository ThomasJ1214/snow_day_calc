import { SITE_URL } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = SITE_URL;
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/auth/"] }, sitemap: `${site}/sitemap.xml` };
}
