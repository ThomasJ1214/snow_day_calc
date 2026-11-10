/**
 * The site's public address, used for canonical links, share images, the sitemap and robots.txt.
 * Order: NEXT_PUBLIC_SITE_URL (set this once you have a custom domain), then the production
 * address Vercel provides automatically, then localhost for local development.
 */
export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl(process.env);
