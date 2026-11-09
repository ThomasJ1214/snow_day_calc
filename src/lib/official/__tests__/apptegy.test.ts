import { describe, expect, it } from "vitest";
import { announcedDate, activeBannerItems, eventsToNoSchoolDays, historyFromBanners } from "../apptegy";

describe("announcedDate", () => {
  it("reads an explicit full date", () =>
    expect(announcedDate("SCHOOLS CLOSED TODAY, Tuesday, December 23, 2025")).toBe("2025-12-23"));
  it("infers the year from the weekday when omitted", () =>
    expect(announcedDate("2-Hour DELAYED OPENING, Wednesday, February 12.")).toBe("2025-02-12"));
  it("prefers the most recent matching year relative to a reference date", () =>
    expect(announcedDate("All schools closed, Monday, February 23.", new Date("2026-03-01T00:00:00Z"))).toBe("2026-02-23"));
  it("returns null without a date", () => expect(announcedDate("We are monitoring tomorrow's weather")).toBeNull());
});

const banner = (id: number, status: string, content: string) => ({ id, status, content, style: "light_box" });

describe("activeBannerItems", () => {
  const now = new Date("2026-12-08T11:00:00Z");
  it("returns only active banners whose announced date is today or later", () => {
    const items = activeBannerItems(
      [
        banner(1, "closed", "<p>Schools closed Monday, December 7, 2026</p>"),
        banner(2, "open", "<p>Due to inclement weather, all Montville Township Public Schools are CLOSED Tuesday, December 8, 2026.</p>"),
        banner(3, "open", "<p>SNOW DAY - Schools Closed Thursday, February 6, 2025.</p>"),
      ],
      now,
      "https://www.montville.net",
    );
    expect(items.map((i) => i.title)).toEqual(["Due to inclement weather, all Montville Township Public Schools are CLOSED Tuesday, December 8, 2026."]);
    expect(items[0].published).toBe(now.toISOString());
  });
});

describe("historyFromBanners", () => {
  it("extracts dated weather closures and delays, skipping non-weather notices", () => {
    const h = historyFromBanners([
      banner(20139, "closed", "<p><span>SNOW DAY - Schools Closed Thursday, February 6, 2025.</span></p>"),
      banner(21006, "closed", "<p>2-Hour DELAYED OPENING, Wednesday, February 12.</p><p>Due to inclement weather</p>"),
      banner(24009, "closed", "<p><strong>Montville Township Public Schools will be CLOSED Tuesday, May 27, 2025 for Memorial Day recess</strong></p>"),
      banner(25767, "closed", "<p>NOTIFICATION: FRIDAY, JUNE 6, 2025: Passaic Valley Rd will be closed</p>"),
      banner(38121, "closed", "<p>Due to a water main break in front of Hilldale Elementary School, there will be a 2-hour delayed opening Tuesday, February 17, 2026</p>"),
      banner(24009, "closed", "<p>Montville Township Public Schools will be CLOSED Tuesday, May 27, 2025. Having Tuesday off is due to the fact that only one (1) Snow/Emergency Day has been needed so far.</p>"),
      banner(20140, "closed", "<p>SNOW DAY - Schools Closed Thursday, February 6, 2025. Stay safe!</p>"),
    ]);
    expect(h).toEqual([
      expect.objectContaining({ date: "2025-02-06", status: "closed" }),
      expect.objectContaining({ date: "2025-02-12", status: "delayed" }),
    ]);
  });
});

describe("eventsToNoSchoolDays", () => {
  it("maps calendar events with no-school titles to dates", () => {
    const days = eventsToNoSchoolDays([
      { title: "Winter Recess - Schools Closed", start_at: "2026-12-24T00:00:00.000-05:00", end_at: "2026-12-26T00:00:00.000-05:00", all_day: true },
      { title: "All Elementary Schools - Start Trimester 2", start_at: "2026-12-01T00:00:00.000-05:00", end_at: "2026-12-01T00:00:00.000-05:00", all_day: true },
      { title: "MTEA Holiday Party", start_at: "2027-01-28T00:00:00.000-05:00", end_at: "2027-01-28T00:00:00.000-05:00", all_day: true },
      { title: "Schools Closed - NJEA Convention", start_at: "2026-11-05T00:00:00.000-05:00", end_at: "2026-11-06T00:00:00.000-05:00", all_day: true },
    ]);
    expect(days.map((d) => d.date)).toEqual(["2026-12-24", "2026-12-25", "2026-12-26", "2026-11-05", "2026-11-06"]);
  });
});
