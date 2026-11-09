import { describe, expect, it } from "vitest";
import { alignSeries } from "../align";
import type { HourlySeries } from "../types";

const mk = (time: string[], precip: number[]): HourlySeries => ({
  time, precipMm: precip, snowfallCm: precip.map(() => null), tempC: precip.map(() => -3), rh: precip.map(() => 90),
  gustKmh: precip.map(() => 5), windKmh: precip.map(() => 3), visibilityM: precip.map(() => null),
  weatherCode: precip.map(() => null), freezingLevelM: precip.map(() => null),
});

describe("alignSeries", () => {
  it("re-indexes a series onto a target timeline by timestamp", () => {
    const s = mk(["2026-12-01T01:00", "2026-12-01T02:00", "2026-12-01T03:00"], [1, 2, 3]);
    const a = alignSeries(s, ["2026-12-01T00:00", "2026-12-01T01:00", "2026-12-01T02:00", "2026-12-01T03:00", "2026-12-01T04:00"]);
    expect(a.precipMm).toEqual([null, 1, 2, 3, null]);
    expect(a.time[0]).toBe("2026-12-01T00:00");
  });
});
