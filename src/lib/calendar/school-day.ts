import { addDays, weekday } from "./dates";

/** School is assumed to start around 7–8 AM; after 7 AM "today" is already decided. */
export const SCHOOL_START_HOUR = 7;

/** The next school day on or after the local date, skipping weekends and known no-school days. */
export function nextSchoolDay(args: {
  localDate: string;
  localHour: number;
  noSchool: Map<string, string>;
}): { date: string; skipped: { date: string; reason: string }[] } {
  const skipped: { date: string; reason: string }[] = [];
  let d = args.localHour < SCHOOL_START_HOUR ? args.localDate : addDays(args.localDate, 1);
  for (let i = 0; i < 40; i++) {
    const w = weekday(d);
    if (w === 0 || w === 6) {
      d = addDays(d, 1);
      continue;
    }
    const reason = args.noSchool.get(d);
    if (!reason) return { date: d, skipped };
    skipped.push({ date: d, reason });
    d = addDays(d, 1);
  }
  return { date: d, skipped };
}
