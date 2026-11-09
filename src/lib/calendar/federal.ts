import { addDays, weekday, ymd } from "./dates";

export interface Holiday {
  date: string;
  name: string;
  /** Most U.S. districts close; false where many districts hold classes (e.g. Veterans Day). */
  schoolsTypicallyClosed: boolean;
}

function nthWeekday(year: number, month: number, dow: number, n: number): string {
  let d = ymd(year, month, 1);
  while (weekday(d) !== dow) d = addDays(d, 1);
  return addDays(d, 7 * (n - 1));
}
function lastWeekday(year: number, month: number, dow: number): string {
  let d = addDays(ymd(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1), -1);
  while (weekday(d) !== dow) d = addDays(d, -1);
  return d;
}
function observed(d: string): string {
  const w = weekday(d);
  return w === 6 ? addDays(d, -1) : w === 0 ? addDays(d, 1) : d;
}

/** U.S. federal holidays (5 U.S.C. 6103) with observed dates, plus the day after Thanksgiving. */
export function federalHolidays(year: number): Holiday[] {
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  return [
    { date: observed(ymd(year, 1, 1)), name: "New Year's Day", schoolsTypicallyClosed: true },
    { date: nthWeekday(year, 1, 1, 3), name: "Martin Luther King Jr. Day", schoolsTypicallyClosed: true },
    { date: nthWeekday(year, 2, 1, 3), name: "Presidents' Day", schoolsTypicallyClosed: true },
    { date: lastWeekday(year, 5, 1), name: "Memorial Day", schoolsTypicallyClosed: true },
    { date: observed(ymd(year, 6, 19)), name: "Juneteenth", schoolsTypicallyClosed: false },
    { date: observed(ymd(year, 7, 4)), name: "Independence Day", schoolsTypicallyClosed: true },
    { date: nthWeekday(year, 9, 1, 1), name: "Labor Day", schoolsTypicallyClosed: true },
    { date: nthWeekday(year, 10, 1, 2), name: "Columbus Day / Indigenous Peoples' Day", schoolsTypicallyClosed: false },
    { date: observed(ymd(year, 11, 11)), name: "Veterans Day", schoolsTypicallyClosed: false },
    { date: thanksgiving, name: "Thanksgiving Day", schoolsTypicallyClosed: true },
    { date: addDays(thanksgiving, 1), name: "Day after Thanksgiving", schoolsTypicallyClosed: true },
    { date: observed(ymd(year, 12, 25)), name: "Christmas Day", schoolsTypicallyClosed: true },
  ];
}
