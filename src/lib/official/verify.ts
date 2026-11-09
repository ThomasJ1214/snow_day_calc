import "server-only";
import { fetchWithTimeout } from "@/lib/server/http";
import { getRegistryEntry } from "./registry";
import { parseFeed, resolveStatus, type FeedItem, type OfficialStatus } from "./status";

const cache = new Map<string, { at: number; items: FeedItem[]; error?: string }>();
const TTL_MS = 5 * 60_000;

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
  const results = await Promise.all(entry.feeds.filter((f) => f.type === "rss").map((f) => loadFeed(f.url)));
  const items = results.flatMap((r) => r.items);
  const allFailed = results.length > 0 && results.every((r) => r.error);
  return resolveStatus({
    registryEntry: entry,
    items,
    now,
    websiteUrl,
    targetDayStartsInHours: opts.targetDayStartsInHours,
    feedError: allFailed ? results[0].error : undefined,
  });
}
