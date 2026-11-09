import { describe, expect, it } from "vitest";
import { federalHolidays } from "../federal";
import { parseNoSchoolDays } from "../ics";
import { nextSchoolDay } from "../school-day";

describe("federalHolidays", () => {
  const h = federalHolidays(2026);
  const dates = h.map((x) => x.date);
  it("includes Thanksgiving and MLK Day 2026", () => {
    expect(dates).toContain("2026-11-26");
    expect(dates).toContain("2026-01-19");
  });
  it("includes the day after Thanksgiving as a typical school closure", () => {
    expect(h.find((x) => x.date === "2026-11-27")?.schoolsTypicallyClosed).toBe(true);
  });
  it("marks Veterans Day as not reliably a school holiday", () => {
    expect(h.find((x) => x.date === "2026-11-11")?.schoolsTypicallyClosed).toBe(false);
  });
  it("applies the observed-date rule (Independence Day 2026 falls on Saturday → Friday)", () => {
    expect(dates).toContain("2026-07-03");
  });
});

describe("parseNoSchoolDays", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261221",
    "DTEND;VALUE=DATE:20270102",
    "SUMMARY:Winter Recess - No School",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART:20261208T180000Z",
    "SUMMARY:Board Meeting",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20270115",
    "SUMMARY:Teacher Professional",
    "  Development Day - No Students",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20270120",
    "SUMMARY:Early Dismissal",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const days = parseNoSchoolDays(ics);
  it("expands multi-day all-day events (DTEND exclusive)", () => {
    expect(days.filter((d) => d.summary.startsWith("Winter Recess"))).toHaveLength(12);
    expect(days.map((d) => d.date)).toContain("2027-01-01");
    expect(days.map((d) => d.date)).not.toContain("2027-01-02");
  });
  it("ignores non-closure events", () => {
    expect(days.find((d) => d.summary === "Board Meeting")).toBeUndefined();
    expect(days.find((d) => d.summary === "Early Dismissal")).toBeUndefined();
  });
  it("unfolds folded lines", () => expect(days.map((d) => d.date)).toContain("2027-01-15"));
});

describe("nextSchoolDay", () => {
  it("targets today when it is before the start of the school day", () => {
    expect(nextSchoolDay({ localDate: "2026-12-08", localHour: 5, noSchool: new Map() }).date).toBe("2026-12-08");
  });
  it("targets tomorrow after school has started", () => {
    expect(nextSchoolDay({ localDate: "2026-12-08", localHour: 9, noSchool: new Map() }).date).toBe("2026-12-09");
  });
  it("skips the weekend from Friday afternoon", () => {
    expect(nextSchoolDay({ localDate: "2026-12-04", localHour: 16, noSchool: new Map() }).date).toBe("2026-12-07");
  });
  it("skips a Monday holiday and reports why", () => {
    const r = nextSchoolDay({ localDate: "2026-12-04", localHour: 16, noSchool: new Map([["2026-12-07", "Staff Day"]]) });
    expect(r.date).toBe("2026-12-08");
    expect(r.skipped).toContainEqual({ date: "2026-12-07", reason: "Staff Day" });
  });
});
