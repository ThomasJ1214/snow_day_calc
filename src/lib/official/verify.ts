import "server-only";
import { fetchWithTimeout } from "@/lib/server/http";
import { getRegistryEntry } from "./registry";
import { parseFeed, resolveStatus, type FeedItem, type OfficialStatus, type RegistryFeed } from "./status";
import { activeBannerItems } from "./apptegy";
import { fetchApptegyBanners, fetchApptegyNews } from "./apptegy-fetch";

const cache = new Map<string, { at: number; items: FeedItem[]; error?: string }>();
const TTL_MS = 5 * 60_000;

async function loadApptegy(feed: RegistryFeed, now: Date): Promise<{ items: FeedItem[]; error?: string }> {
  const c = { parentOrgId: feed.parentOrgId!, orgId: feed.orgId! };
  try {
    const [banners, news] = await Promise.all([fetchApptegyBanners(c), fetchApptegyNews(c).catch(() => [])]);
    const site = new URL(feed.url).origin;
    const items: FeedItem[] = [
      ...activeBannerItems(banners, now, site),
      ...news.map((n) => ({ title: n.title, link: n.link, published: n.published_at ? new Date(n.published_at).toISOString() : null, summary: n.snippet })),
    ];
    return { items };
  } catch (e) {
    return { items: [], error: e instanceof Error && e.name === "AbortError" ? "timed out" : "unreachable" };
  }
}

async function loadFeed(url: string): Promise<{ items: FeedItem[]; error?: string }> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  try {
    const res = await fetchWithTimeout(url, { timeoutMs: 8_000, retries: 0, headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
    const value = res.ok ? { items: parseFeed(await res.text()) } : { items: [], error: `HTTP ${res.status}` };
    cache.set(url, { at: Date.now(), ...value });
    return value;
  } catch (e) {
    const value = { items: [], error: e instanceof Error && e.name === "AbortError" ? "timed out" : "network error" };
    cache.set(url, { at: Date.now(), ...value });
    return value;
  }
}

/**
 * Official status for a district. Only RSS/Atom feeds listed in the curated registry are read;
 * items carry publication times, so stale posts can't be mistaken for today's decision.
 */
export async function verifyDistrict(
  leaid: string | null,
  websiteUrl: string | null,
  opts: { targetDayStartsInHours?: number; now?: Date } = {},
): Promise<OfficialStatus> {
  const entry = getRegistryEntry(leaid);
  const now = opts.now ?? new Date();
  if (!entry) return resolveStatus({ registryEntry: null, items: [], now, websiteUrl });
  const results = await Promise.all(entry.feeds.map((f) => (f.type === "apptegy" ? loadApptegy(f, now) : loadFeed(f.url))));
  const items = results.flatMap((r) => r.items);
  const allFailed = results.length > 0 && results.every((r) => r.error);
  return resolveStatus({
    registryEntry: entry,
    items,
    now,
    websiteUrl: entry.website ?? websiteUrl,
    targetDayStartsInHours: opts.targetDayStartsInHours,
    feedError: allFailed ? results[0].error : undefined,
  });
}
