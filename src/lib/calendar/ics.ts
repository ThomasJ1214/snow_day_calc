import { addDays, toMs } from "./dates";

const NO_SCHOOL =
  /\b(no school|no classes|no students|schools? closed|district closed|holiday|break|recess|vacation|teacher (work ?day|in-?service|planning)|professional (development|learning)|staff development|in-?service|conference day|records day|non-?student day)\b/i;
const EXCLUDE = /\b(early (dismissal|release)|half[- ]day|board|meeting|concert|game|practice|deadline|registration|make-?up day)\b/i;
const MAX_EVENT_DAYS = 31;

function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function dateOf(value: string): string | null {
  const m = value.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Days without school from an iCalendar feed, based on event summaries (all-day ranges expanded). */
export function parseNoSchoolDays(ics: string): { date: string; summary: string }[] {
  const out: { date: string; summary: string }[] = [];
  let ev: { start?: string; end?: string; summary?: string; allDay?: boolean } | null = null;
  for (const line of unfold(ics)) {
    if (line === "BEGIN:VEVENT") ev = {};
    else if (line === "END:VEVENT" && ev) {
      const { start, summary } = ev;
      if (start && summary && NO_SCHOOL.test(summary) && !EXCLUDE.test(summary)) {
        let end = ev.end ?? addDays(start, 1);
        if (!ev.allDay && ev.end) end = addDays(ev.end, ev.end === start ? 1 : 0);
        const days = Math.min(MAX_EVENT_DAYS, Math.max(1, Math.round((toMs(end) - toMs(start)) / 86_400_000)));
        for (let i = 0; i < days; i++) out.push({ date: addDays(start, i), summary: summary.trim() });
      }
      ev = null;
    } else if (ev) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).toUpperCase();
      const value = line.slice(idx + 1);
      if (key.startsWith("DTSTART")) {
        ev.start = dateOf(value) ?? undefined;
        ev.allDay = key.includes("VALUE=DATE") || /^\d{8}$/.test(value.trim());
      } else if (key.startsWith("DTEND")) ev.end = dateOf(value) ?? undefined;
      else if (key === "SUMMARY") ev.summary = value.replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\n/gi, " ");
    }
  }
  return out;
}
