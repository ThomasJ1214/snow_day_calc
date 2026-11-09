import { XMLParser } from "fast-xml-parser";

export type OfficialStatusCode =
  | "officially_closed"
  | "officially_delayed"
  | "no_cancellation_announced"
  | "prediction_only"
  | "unavailable";

export interface FeedItem {
  title: string;
  link: string | null;
  published: string | null;
  summary?: string;
}

export interface RegistryFeed {
  type: "rss" | "page";
  url: string;
  label?: string;
}

export interface RegistryEntry {
  leaid: string;
  name: string;
  state?: string;
  feeds: RegistryFeed[];
  calendarIcs?: string[];
  notes?: string;
}

export interface OfficialStatus {
  status: OfficialStatusCode;
  headline: string;
  sourceUrl: string | null;
  sourceName: string | null;
  evidence?: FeedItem;
  verifiedAt: string;
  websiteUrl: string | null;
}

export const RECENT_HOURS = 18;
export const ANNOUNCEMENT_WINDOW_HOURS = 20;

const NEGATIONS = [
  /\bno (delays?|closures?|closings?|cancell?ations?)\b/,
  /\bopens? on time\b|\bopening on time\b|\bon a regular schedule\b|\bregular schedule\b/,
  /\bnot (be )?(closed|closing|delayed|cancell?ed)\b/,
  /\b(will be|are|is|remains?|will remain) open\b/,
];
const PLANNED = /\b(winter|spring|fall|holiday|mid-?winter) (break|recess)\b|\brecess\b|\bvacation\b|\bthanksgiving\b|\bchristmas\b|\bteacher (work ?day|in-?service)\b|\bprofessional (development|learning) day\b|\bconference day\b/;
const WEATHER = /\b(snow|ice|icy|weather|storm|cold|wind ?chill|road|freezing|sleet|blizzard|inclement|emergency|power outage)\b/;
const SCHOOL = /\b(schools?|classes|district|students|campus(es)?|buildings)\b/;
const CLOSED = [
  /\b(schools?|classes|district|buildings|campus(es)?)\b[^.!?]{0,40}\b(closed|closing|cancell?ed)\b/,
  /\b(closed|cancell?ed)\b[^.!?]{0,20}\b(schools?|classes)\b/,
  /\bno school\b/,
  /\bsnow day\b/,
  /\b(remote|virtual|e-?learning|nti|amis) (learning )?day\b/,
];
const DELAYED = [
  /\b(\d+(\.\d+)?|one|two|three|1½|90[- ]minute)[- ]?(hour|hr)?s?[- ]?(delay|delayed (opening|start))\b/,
  /\bdelayed (opening|start)\b/,
  /\blate (start|opening|arrival)\b/,
  /\bopens? \d+ (minutes|hours?) late\b/,
];

function normalize(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/[–—]/g, "-")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Classifies a single announcement as a weather closure, a delay, or neither. */
export function classifyAnnouncement(raw: string): "closed" | "delayed" | null {
  const text = normalize(raw);
  if (NEGATIONS.some((r) => r.test(text))) return null;
  if (PLANNED.test(text) && !WEATHER.test(text)) return null;
  const closed = CLOSED.some((r) => r.test(text));
  const delayed = DELAYED.some((r) => r.test(text));
  if (closed && (SCHOOL.test(text) || /\bno school\b|\bsnow day\b|learning day\b/.test(text))) return "closed";
  if (delayed && (SCHOOL.test(text) || /\bdelayed (opening|start)\b|\blate (start|opening)\b|\bhour delay\b/.test(text))) return "delayed";
  return null;
}

export function resolveStatus(args: {
  registryEntry: RegistryEntry | null;
  items: FeedItem[];
  now: Date;
  websiteUrl: string | null;
  /** Hours until the start of the school day being predicted; enables `prediction_only`. */
  targetDayStartsInHours?: number;
  feedError?: string;
}): OfficialStatus {
  const { registryEntry, items, now, websiteUrl } = args;
  const verifiedAt = now.toISOString();
  if (!registryEntry || registryEntry.feeds.length === 0) {
    return {
      status: "unavailable",
      headline: "Official information unavailable — automated verification isn't set up for this district yet.",
      sourceUrl: null,
      sourceName: null,
      verifiedAt,
      websiteUrl,
    };
  }
  const feed = registryEntry.feeds[0];
  if (args.feedError) {
    return {
      status: "unavailable",
      headline: `Couldn't reach the district's announcement feed (${args.feedError}). Check the official website.`,
      sourceUrl: feed.url,
      sourceName: registryEntry.name,
      verifiedAt,
      websiteUrl,
    };
  }
  const cutoff = now.getTime() - RECENT_HOURS * 3600_000;
  const horizon = now.getTime() + 3600_000;
  let delayed: FeedItem | undefined;
  for (const item of items) {
    const t = item.published ? Date.parse(item.published) : NaN;
    if (!Number.isFinite(t) || t < cutoff || t > horizon) continue;
    const kind = classifyAnnouncement(`${item.title}. ${item.summary ?? ""}`);
    if (kind === "closed") {
      return {
        status: "officially_closed",
        headline: item.title,
        sourceUrl: item.link ?? feed.url,
        sourceName: registryEntry.name,
        evidence: item,
        verifiedAt,
        websiteUrl,
      };
    }
    if (kind === "delayed" && !delayed) delayed = item;
  }
  if (delayed) {
    return {
      status: "officially_delayed",
      headline: delayed.title,
      sourceUrl: delayed.link ?? feed.url,
      sourceName: registryEntry.name,
      evidence: delayed,
      verifiedAt,
      websiteUrl,
    };
  }
  if (args.targetDayStartsInHours != null && args.targetDayStartsInHours > ANNOUNCEMENT_WINDOW_HOURS) {
    return {
      status: "prediction_only",
      headline: "Too early for an official decision — districts typically announce the evening before or by early morning.",
      sourceUrl: feed.url,
      sourceName: registryEntry.name,
      verifiedAt,
      websiteUrl,
    };
  }
  return {
    status: "no_cancellation_announced",
    headline: "No closure or delay has been announced in the district's official feed.",
    sourceUrl: feed.url,
    sourceName: registryEntry.name,
    verifiedAt,
    websiteUrl,
  };
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return text((v as Record<string, unknown>)["#text"]);
  return "";
}

function isoOrNull(v: string): string | null {
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom feeds into items. Never throws. */
export function parseFeed(xml: string): FeedItem[] {
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true, htmlEntities: true });
    const doc = parser.parse(xml) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const rssItems = doc?.rss?.channel?.item ?? doc?.["rdf:RDF"]?.item;
    if (rssItems) {
      return (Array.isArray(rssItems) ? rssItems : [rssItems]).map((it) => ({
        title: text(it.title).trim(),
        link: text(it.link).trim() || null,
        published: isoOrNull(text(it.pubDate ?? it["dc:date"] ?? it.date)),
        summary: text(it.description).slice(0, 2000),
      }));
    }
    const entries = doc?.feed?.entry;
    if (entries) {
      return (Array.isArray(entries) ? entries : [entries]).map((e) => {
        const links = Array.isArray(e.link) ? e.link : [e.link];
        const alt = links.find((l: Record<string, string>) => l && (!l["@_rel"] || l["@_rel"] === "alternate")) ?? links[0];
        return {
          title: text(e.title).trim(),
          link: alt?.["@_href"] ?? null,
          published: isoOrNull(text(e.updated ?? e.published)),
          summary: text(e.summary ?? e.content).slice(0, 2000),
        };
      });
    }
    return [];
  } catch {
    return [];
  }
}
