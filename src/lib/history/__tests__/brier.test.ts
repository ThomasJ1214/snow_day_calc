import { describe, expect, it } from "vitest";
import { brierScore, calibration, seasonOf, seasonCounts } from "../brier";

describe("brierScore", () => {
  it("is 0 for perfect forecasts", () => expect(brierScore([{ p: 1, o: 1 }, { p: 0, o: 0 }])).toBe(0));
  it("is 0.25 for a coin flip that happened", () => expect(brierScore([{ p: 0.5, o: 1 }])).toBe(0.25));
});
describe("calibration", () => {
  it("withholds a score until at least 10 matched days exist", () => {
    expect(calibration(Array.from({ length: 9 }, () => ({ p: 0.1, o: 0 })))).toBeNull();
    expect(calibration(Array.from({ length: 10 }, () => ({ p: 0.1, o: 0 })))?.n).toBe(10);
  });
});
describe("seasons", () => {
  it("assigns Dec 2025 and Feb 2026 to the 2025–26 season", () => {
    expect(seasonOf("2025-12-23")).toBe("2025–26");
    expect(seasonOf("2026-02-23")).toBe("2025–26");
    expect(seasonOf("2025-02-06")).toBe("2024–25");
  });
  it("counts closures and delays per season", () => {
    expect(seasonCounts([{ date: "2025-02-06", status: "closed" }, { date: "2025-02-12", status: "delayed" }, { date: "2025-12-23", status: "closed" }])).toEqual([
      { season: "2025–26", closed: 1, delayed: 0 },
      { season: "2024–25", closed: 1, delayed: 1 },
    ]);
  });
});
