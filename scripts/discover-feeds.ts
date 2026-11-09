/**
 * Discovers official district RSS/Atom feeds for the curated status registry.
 *
 *   npx tsx scripts/discover-feeds.ts --states MA,NY,PA --limit 400
 *
 * For each regular public school district (NCES CCD) with a listed website, it loads the
 * homepage, looks for <link rel="alternate" type="application/rss+xml|atom+xml">, then tries
 * the conventional "/feed/" path. A feed is accepted only if it parses and has at least one
 * item published within the last 365 days. Accepted districts are merged into
 * src/lib/official/registry.json (existing entries are kept).
 */
import fs from "node:fs";
import path from "node:path";
import { parseFeed } from "../src/lib/official/status";
import { loadDistrictCsv } from "./lib/nces";

const UA = "Mozilla/5.0 (compatible; SnowDayFeedDiscovery/1.0; +https://github.com/ThomasJ1214/snow_day_calc)";
const REGISTRY = path.join(__dirname, "../src/lib/official/registry.json");

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function get(url: string, ms = 8000): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: ctrl.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: text.slice(0, 2_000_000), finalUrl: res.url };
  } catch {
    return { ok: false, status: 0, text: "", finalUrl: url };
  } finally {
    clearTimeout(t);
  }
}

function feedLinks(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<link\b[^>]*>/gi;
  for (const tag of html.match(re) ?? []) {
    if (!/rel=["']?alternate/i.test(tag)) continue;
    if (!/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || /comments/i.test(href)) continue;
    try {
      out.push(new URL(href.replace(/&amp;/g, "&"), base).toString());
    } catch {
      /* ignore */
    }
  }
  return out;
}

async function validFeed(url: string): Promise<{ url: string; items: number } | null> {
  const res = await get(url);
  if (!res.ok || !/<(rss|feed|rdf:RDF)\b/i.test(res.text)) return null;
  const items = parseFeed(res.text);
  const yearAgo = Date.now() - 365 * 86400_000;
  const recent = items.filter((i) => i.published && Date.parse(i.published) > yearAgo);
  return recent.length ? { url: res.finalUrl, items: recent.length } : null;
}

async function discover(website: string): Promise<string | null> {
  const home = website.startsWith("http") ? website : `https://${website}`;
  const page = await get(home);
  if (page.ok) {
    for (const link of feedLinks(page.text, page.finalUrl)) {
      const v = await validFeed(link);
      if (v) return v.url;
    }
  }
  const origin = (() => {
    try {
      return new URL(page.finalUrl || home).origin;
    } catch {
      return null;
    }
  })();
  if (!origin) return null;
  const wp = await validFeed(`${origin}/feed/`);
  return wp?.url ?? null;
}

async function main() {
  const states = arg("states", "AL,AZ,AR,CA,GA,HI,LA,MS,NM,NV,OK,SC,TX,FL,ME,NH,VT,MA,RI,CT,NY,NJ,PA,MD,DE,VA,WV,OH,MI,IN,IL,WI,MN,IA,MO,KY,NC,TN,CO,UT,ID,MT,WY,ND,SD,NE,KS,WA,OR,AK").split(",");
  const limit = Number(arg("limit", "300"));
  const offset = Number(arg("offset", "0"));
  const concurrency = Number(arg("concurrency", "16"));
  const districts = (await loadDistrictCsv())
    .filter((d) => d.website && states.includes(d.state) && d.leaType === "1" && d.operational)
    .slice(offset, offset + limit);
  console.log(`Probing ${districts.length} districts…`);

  const found: { leaid: string; name: string; state: string; feeds: { type: "rss"; url: string; label: string }[] }[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < districts.length) {
        const d = districts[i++];
        const url = await discover(d.website!);
        if (url) {
          found.push({ leaid: d.leaid, name: d.name, state: d.state, feeds: [{ type: "rss", url, label: "District news feed" }] });
          console.log(`✓ ${d.state} ${d.name} → ${url}`);
        }
      }
    }),
  );

  const current = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  const byId = new Map<string, unknown>(current.districts.map((e: { leaid: string }) => [e.leaid, e]));
  for (const f of found) if (!byId.has(f.leaid)) byId.set(f.leaid, f);
  current.districts = [...byId.values()].sort((a, b) =>
    `${(a as { state: string }).state}${(a as { name: string }).name}`.localeCompare(`${(b as { state: string }).state}${(b as { name: string }).name}`),
  );
  current.generatedAt = new Date().toISOString();
  fs.writeFileSync(REGISTRY, JSON.stringify(current, null, 2) + "\n");
  console.log(`Found ${found.length} feeds; registry now has ${current.districts.length} districts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
