import { describe, expect, it } from "vitest";
import { parseValidTime, sumIntervals } from "../ndfd";

describe("parseValidTime", () => {
  it("parses hour durations", () => {
    const v = parseValidTime("2026-11-09T06:00:00+00:00/PT6H");
    expect(v).toEqual({ startMs: Date.parse("2026-11-09T06:00:00Z"), hours: 6 });
  });
  it("parses day + hour durations", () => expect(parseValidTime("2026-11-09T00:00:00+00:00/P1DT6H")?.hours).toBe(30));
  it("returns null for junk", () => expect(parseValidTime("nope")).toBeNull());
});

describe("sumIntervals", () => {
  const values = [
    { validTime: "2026-11-09T00:00:00+00:00/PT6H", value: 12 },
    { validTime: "2026-11-09T06:00:00+00:00/PT6H", value: 6 },
    { validTime: "2026-11-09T12:00:00+00:00/PT6H", value: null },
  ];
  it("sums fully covered intervals", () => {
    expect(sumIntervals(values, Date.parse("2026-11-09T00:00:00Z"), 12)).toBe(18);
  });
  it("prorates partially covered intervals", () => {
    expect(sumIntervals(values, Date.parse("2026-11-09T03:00:00Z"), 6)).toBeCloseTo(6 + 3, 5);
  });
  it("returns null when the window extends past the data", () => {
    expect(sumIntervals(values, Date.parse("2026-11-09T00:00:00Z"), 48)).toBeNull();
  });
});
