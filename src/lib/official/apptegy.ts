/**
 * Apptegy (Thrillshare) district websites publish their alert banners, news and calendar as public
 * JSON. Used for districts whose registry entry has an `apptegy` feed (e.g. Montville Township, NJ).
 */
import { addDays, weekday } from "@/lib/calendar/dates";
import { EXCLUDE_NON_CLOSURE, NO_SCHOOL } from "@/lib/calendar/ics";
import { classifyAnnouncement, type FeedItem } from "./status";

/** The announcement must give weather as the cause (not merely mention snow days). */
const WEATHER_CAUSE =
  /\b(due to|because of)\s+(the\s+)?(forecast(ed)?\s+)?(inclement|winter|severe|hazardous|icy|snow|ice|weather|storm|road|extreme|freezing)|\bsnow day\b|\binclement weather\b/i;

export interface ApptegyBanner {
  id: number;
  status: string;
  content: string;
  style?: string;
}
export interface ApptegyEvent {
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const INACTIVE = new Set(["closed", "archived", "draft", "expired", "inactive"]);

export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|h\d|div|li|br)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** The date an announcement refers to ("Tuesday, December 23, 2025" or "Wednesday, February 12"). */
export function announcedDate(text: string, ref: Date = new Date()): string | null {
  const re = new RegExp(`(?:(${DAYS.join("|")}),?\\s+)?(${MONTHS.join("|")})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, "i");
  const m = htmlToText(text).match(re);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  const day = Number(m[3]);
  const fmt = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (m[4]) return fmt(Number(m[4]));
  const refYear = ref.getUTCFullYear();
  const dow = m[1] ? DAYS.indexOf(m[1].toLowerCase()) : null;
  const candidates = [refYear - 2, refYear - 1, refYear, refYear + 1]
    .map(fmt)
    .filter((d) => dow == null || weekday(d) === dow);
  if (!candidates.length) return null;
  const refMs = ref.getTime() + 7 * 86_400_000;
  const past = candidates.filter((d) => Date.parse(d) <= refMs);
  return (past.length ? past : candidates).sort((a, b) => Math.abs(Date.parse(a) - refMs) - Math.abs(Date.parse(b) - refMs))[0];
}

/** Active alert banners (currently displayed on the district site) as feed items, ignoring stale dated ones. */
export function activeBannerItems(banners: ApptegyBanner[], now: Date, siteUrl: string): FeedItem[] {
  const today = new Date(now.getTime() - 12 * 3_600_000).toISOString().slice(0, 10);
  return banners
    .filter((b) => !INACTIVE.has(String(b.status).toLowerCase()))
    .map((b) => ({ b, text: htmlToText(b.content) }))
    .filter(({ text }) => {
      const d = announcedDate(text, now);
      return !d || d >= today;
    })
    .map(({ text }) => ({ title: text.slice(0, 280), link: siteUrl, published: now.toISOString(), summary: text }));
}

export interface HistoricalAnnouncement {
  date: string;
  status: "closed" | "delayed";
  text: string;
  bannerId: number;
}

/** Past official weather closures/delays from archived banners (date taken from the announcement text). */
export function historyFromBanners(banners: ApptegyBanner[], ref: Date = new Date()): HistoricalAnnouncement[] {
  const byDate = new Map<string, HistoricalAnnouncement>();
  for (const b of banners) {
    const text = htmlToText(b.content);
    const status = classifyAnnouncement(text);
    const date = announcedDate(text, ref);
    if (!status || !date || !WEATHER_CAUSE.test(text)) continue;
    if (weekday(date) === 0 || weekday(date) === 6) continue; // weekend building closures aren't school-day decisions
    const prev = byDate.get(date);
    // a closure supersedes an earlier delay announcement for the same day
    if (!prev || (prev.status === "delayed" && status === "closed")) byDate.set(date, { date, status, text: text.slice(0, 280), bannerId: b.id });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function eventsToNoSchoolDays(events: ApptegyEvent[]): { date: string; summary: string }[] {
  const out: { date: string; summary: string }[] = [];
  for (const e of events) {
    if (!NO_SCHOOL.test(e.title) || EXCLUDE_NON_CLOSURE.test(e.title)) continue;
    const start = e.start_at.slice(0, 10);
    const end = e.end_at.slice(0, 10) < start ? start : e.end_at.slice(0, 10);
    for (let d = start, i = 0; d <= end && i < 31; d = addDays(d, 1), i++) out.push({ date: d, summary: e.title });
  }
  return out;
}
