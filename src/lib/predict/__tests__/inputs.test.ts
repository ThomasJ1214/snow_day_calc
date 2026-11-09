import { describe, expect, it } from "vitest";
import { closureInputsForDay, windChillF } from "../inputs";
import type { HourPoint } from "@/lib/snow/analyze";

function hours(start: string, n: number, f: (local: string, i: number) => Partial<HourPoint>): HourPoint[] {
  const base = Date.parse(start + ":00Z");
  return Array.from({ length: n }, (_, i) => {
    const time = new Date(base + i * 3600_000).toISOString().slice(0, 16);
    return {
      time, rateLow: 0, rateLikely: 0, rateHigh: 0, cumLow: 0, cumLikely: 0, cumHigh: 0,
      tempC: 0, rh: 90, gustKmh: 10, windKmh: 8, visibilityM: 16000, precipMm: 0, phase: null, iceMm: 0, past: false,
      ...f(time, i),
    };
  });
}

describe("windChillF", () => {
  it("matches the NWS chart (0 °F, 15 mph → −19 °F)", () => expect(windChillF(0, 15)).toBeCloseTo(-19, 0));
  it("equals air temperature in light wind or warm air", () => {
    expect(windChillF(20, 2)).toBe(20);
    expect(windChillF(55, 20)).toBe(55);
  });
});

describe("closureInputsForDay", () => {
  // 1 cm/h of snow from 22:00 to 03:59 (6 h = 6 cm ≈ 2.36″), plus 0.5 cm/h 05:00–07:59 (1.5 cm)
  const hp = hours("2026-12-07T12:00", 48, (t) => {
    const h = Number(t.slice(11, 13));
    const day = t.slice(0, 10);
    let rate = 0;
    if ((day === "2026-12-07" && h >= 22) || (day === "2026-12-08" && h < 4)) rate = 1;
    if (day === "2026-12-08" && h >= 5 && h < 8) rate = 0.5;
    if (day === "2026-12-08" && h >= 11 && h < 13) rate = 2;
    return { rateLikely: rate, tempC: day === "2026-12-08" && h === 6 ? -12 : -3, gustKmh: h === 6 ? 60 : 10, visibilityM: h === 7 ? 500 : 16000 };
  });

  it("splits overnight, commute and dismissal snowfall in inches", () => {
    const r = closureInputsForDay(hp, "2026-12-08");
    expect(r).not.toBeNull();
    expect(r!.overnightSnowIn).toBeCloseTo((6 + 1) / 2.54, 2); // 18:00–06:59 includes 05:00, 06:00
    expect(r!.commuteSnowIn).toBeCloseTo(1.5 / 2.54, 2);
    expect(r!.dismissalWindowSnowIn).toBeCloseTo(4 / 2.54, 2);
  });

  it("finds the morning low, max gust and min visibility", () => {
    const r = closureInputsForDay(hp, "2026-12-08")!;
    expect(r.morningLowF).toBeCloseTo(10.4, 1);
    expect(r.maxGustMph).toBeCloseTo(60 / 1.609, 0);
    expect(r.minVisibilityMi).toBeCloseTo(0.31, 2);
  });

  it("returns null when the forecast does not cover the school morning", () => {
    expect(closureInputsForDay(hp, "2026-12-11")).toBeNull();
  });
});
