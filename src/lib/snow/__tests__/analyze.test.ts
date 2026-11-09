import { describe, expect, it } from "vitest";
import { percentile } from "../percentiles";
import { windowTotals } from "../accumulate";
import { hourlySnowCm, analyzeSnow } from "../analyze";
import type { HourlySeries } from "@/lib/weather/types";

function series(hours: number, f: (i: number) => Partial<Record<keyof HourlySeries, number | null>>, start = "2026-12-01T00:00"): HourlySeries {
  const base = new Date(start + ":00Z").getTime();
  const s: HourlySeries = {
    time: [], precipMm: [], snowfallCm: [], tempC: [], rh: [], gustKmh: [], windKmh: [],
    visibilityM: [], weatherCode: [], freezingLevelM: [],
  };
  for (let i = 0; i < hours; i++) {
    s.time.push(new Date(base + i * 3600_000).toISOString().slice(0, 16));
    const v = f(i);
    s.precipMm.push(v.precipMm === undefined ? 0 : v.precipMm);
    s.snowfallCm.push(v.snowfallCm === undefined ? null : v.snowfallCm);
    s.tempC.push(v.tempC === undefined ? -5 : v.tempC);
    s.rh.push(v.rh === undefined ? 95 : v.rh);
    s.gustKmh.push(v.gustKmh === undefined ? 10 : v.gustKmh);
    s.windKmh.push(v.windKmh === undefined ? 5 : v.windKmh);
    s.visibilityM.push(v.visibilityM === undefined ? 20000 : v.visibilityM);
    s.weatherCode.push(v.weatherCode === undefined ? 0 : v.weatherCode);
    s.freezingLevelM!.push(v.freezingLevelM === undefined ? 0 : v.freezingLevelM);
  }
  return s;
}

describe("percentile", () => {
  it("interpolates linearly", () => expect(percentile([0, 10], 0.5)).toBe(5));
  it("handles unsorted input", () => expect(percentile([9, 1, 5], 0.5)).toBe(5));
  it("returns NaN for empty input", () => expect(Number.isNaN(percentile([], 0.5))).toBe(true));
});

describe("windowTotals", () => {
  it("sums forward from the start index", () => {
    const arr = Array.from({ length: 80 }, () => 1);
    const w = windowTotals(arr, 2);
    expect(w[3]).toBe(3);
    expect(w[24]).toBe(24);
    expect(w[72]).toBe(72);
  });
  it("returns null for windows the data does not cover", () => {
    const w = windowTotals(Array.from({ length: 30 }, () => 1), 0);
    expect(w[24]).toBe(24);
    expect(w[48]).toBeNull();
  });
  it("treats a null hour inside the window as missing coverage", () => {
    const arr: (number | null)[] = Array.from({ length: 80 }, () => 1);
    arr[10] = null;
    const w = windowTotals(arr, 0);
    expect(w[6]).toBe(6);
    expect(w[12]).toBeNull();
  });
});

describe("hourlySnowCm", () => {
  it("applies the temperature-dependent ratio to snow-phase liquid", () => {
    const s = series(1, () => ({ precipMm: 2, tempC: -5, rh: 95 }));
    expect(hourlySnowCm(s, 0)).toBeCloseTo((2 * 13) / 10, 5);
  });
  it("returns 0 for rain even if the model reports snowfall", () => {
    const s = series(1, () => ({ precipMm: 3, tempC: 6, rh: 90, snowfallCm: 1.5 }));
    expect(hourlySnowCm(s, 0)).toBe(0);
  });
  it("uses the lower value in mixed precipitation", () => {
    const s = series(1, () => ({ precipMm: 4, tempC: 1.4, rh: 95, snowfallCm: 0.5 }));
    expect(hourlySnowCm(s, 0)).toBeLessThanOrEqual(0.5);
  });
  it("falls back to model snowfall when precipitation is missing", () => {
    const s = series(1, () => ({ precipMm: null, snowfallCm: 0.7 }));
    expect(hourlySnowCm(s, 0)).toBe(0.7);
  });
});

describe("analyzeSnow", () => {
  const members = Array.from({ length: 11 }, (_, m) =>
    // member m produces m cm total over hours 5..14 (10 hours) at −5 °C → 1.3 cm per mm
    series(80, (i) => ({ precipMm: i >= 5 && i < 15 ? m / 13 : 0 })),
  );

  it("derives low/likely/high from ensemble 10th/50th/90th percentiles", () => {
    const a = analyzeSnow({ deterministic: {}, ensemble: members, nowIndex: 0 });
    expect(a.method).toBe("ensemble");
    expect(a.windows["24"].low).toBeCloseTo(1, 1);
    expect(a.windows["24"].likely).toBeCloseTo(5, 1);
    expect(a.windows["24"].high).toBeCloseTo(9, 1);
  });

  it("computes probability of measurable snow from members", () => {
    const a = analyzeSnow({ deterministic: {}, ensemble: members, nowIndex: 0 });
    // members 1..10 exceed 0.25 cm → 10/11
    expect(a.pMeasurable).toBeCloseTo(10 / 11, 5);
  });

  it("falls back to model spread when no ensemble is available", () => {
    const det = {
      a: series(80, (i) => ({ precipMm: i < 10 ? 0.1 : 0 })),
      b: series(80, (i) => ({ precipMm: i < 10 ? 0.3 : 0 })),
      c: series(80, (i) => ({ precipMm: i < 10 ? 0.2 : 0 })),
    };
    const a = analyzeSnow({ deterministic: det, ensemble: [], nowIndex: 0 });
    expect(a.method).toBe("model-spread");
    expect(a.windows["24"].low).toBeCloseTo(1.3, 5);
    expect(a.windows["24"].likely).toBeCloseTo(2.6, 5);
    expect(a.windows["24"].high).toBeCloseTo(3.9, 5);
    expect(a.pMeasurable).toBeNull();
  });

  it("returns zeros, no NaN and no start time when no snow is forecast", () => {
    const dry = series(80, () => ({ precipMm: 0, tempC: 25, rh: 60 }));
    const a = analyzeSnow({ deterministic: { a: dry }, ensemble: [dry, dry, dry], nowIndex: 0 });
    for (const k of ["3", "6", "12", "24", "48", "72"] as const) {
      expect(a.windows[k].likely).toBe(0);
      expect(a.windows[k].high).toBe(0);
    }
    expect(a.startTime).toBeNull();
    expect(a.endTime).toBeNull();
    expect(a.peakRateCmH).toBe(0);
    expect(["High", "Moderate", "Low"]).toContain(a.confidence.label);
    expect(JSON.stringify(a)).not.toContain("NaN");
  });

  it("finds start, end and peak from the likely hourly series", () => {
    const a = analyzeSnow({ deterministic: {}, ensemble: members, nowIndex: 0 });
    expect(a.startTime).toBe("2026-12-01T05:00");
    expect(a.endTime).toBe("2026-12-01T14:00");
    expect(a.peakRateCmH).toBeCloseTo(0.5, 1);
  });

  it("groups daily totals by the local date in the time string", () => {
    const s = series(80, (i) => ({ precipMm: i === 3 || i === 30 ? 1 : 0 }), "2026-12-01T22:00");
    const a = analyzeSnow({ deterministic: {}, ensemble: [s, s, s], nowIndex: 0 });
    const d1 = a.daily.find((d) => d.date === "2026-12-01");
    const d2 = a.daily.find((d) => d.date === "2026-12-02");
    const d3 = a.daily.find((d) => d.date === "2026-12-03");
    expect(d1?.likelyCm).toBeCloseTo(0, 5);
    expect(d2?.likelyCm).toBeCloseTo(1.3, 5);
    expect(d3?.likelyCm).toBeCloseTo(1.3, 5);
  });

  it("detects freezing rain and rain-to-snow transitions from the primary model", () => {
    const det = {
      primary: series(80, (i) => ({
        precipMm: i < 12 ? 2 : 0,
        tempC: i < 4 ? 4 : i < 8 ? -1 : -6,
        weatherCode: i >= 4 && i < 8 ? 66 : 0,
      })),
    };
    const a = analyzeSnow({ deterministic: det, ensemble: [], nowIndex: 0 });
    expect(a.iceRiskMm).toBeCloseTo(8, 5);
    expect(a.transitions.map((t) => `${t.from}->${t.to}`)).toEqual(["rain->freezing_rain", "freezing_rain->snow"]);
  });

  it("lowers confidence when members disagree widely", () => {
    const tight = Array.from({ length: 11 }, () => series(80, (i) => ({ precipMm: i >= 5 && i < 15 ? 0.4 : 0 })));
    const a = analyzeSnow({ deterministic: {}, ensemble: tight, nowIndex: 0 });
    const b = analyzeSnow({ deterministic: {}, ensemble: members, nowIndex: 0 });
    expect(a.confidence.score).toBeGreaterThan(b.confidence.score);
  });
});
