import { describe, expect, it } from "vitest";
import { wetBulbC } from "../wetbulb";
import { classifyPhase } from "../phase";
import { slrFor } from "../slr";

describe("wetBulbC (Stull 2011)", () => {
  it("matches Stull's reference value at 20 °C / 50% RH", () => {
    expect(wetBulbC(20, 50)).toBeCloseTo(13.7, 0);
    expect(Math.abs(wetBulbC(20, 50) - 13.7)).toBeLessThan(0.3);
  });
  it("approaches air temperature at saturation", () => {
    expect(Math.abs(wetBulbC(1, 100) - 1)).toBeLessThan(0.25);
  });
  it("clamps RH outside the valid range instead of returning NaN", () => {
    expect(Number.isFinite(wetBulbC(-5, 0))).toBe(true);
    expect(Number.isFinite(wetBulbC(-5, 120))).toBe(true);
  });
});

describe("classifyPhase", () => {
  it("is snow when wet-bulb is well below freezing", () => {
    expect(classifyPhase({ tC: -2, rh: 95 })).toBe("snow");
  });
  it("is rain when wet-bulb is above 2 °C", () => {
    expect(classifyPhase({ tC: 5, rh: 90 })).toBe("rain");
  });
  it("is mix in the transition band", () => {
    expect(classifyPhase({ tC: 1.4, rh: 95 })).toBe("mix");
  });
  it("is freezing rain for WMO freezing-rain codes", () => {
    expect(classifyPhase({ tC: -1, rh: 95, weatherCode: 66 })).toBe("freezing_rain");
    expect(classifyPhase({ tC: -1, rh: 95, weatherCode: 57 })).toBe("freezing_rain");
  });
  it("is freezing rain when surface is sub-freezing under a warm layer aloft", () => {
    expect(classifyPhase({ tC: -1, rh: 95, freezingLevelM: 1900, elevationM: 200 })).toBe("freezing_rain");
  });
  it("does not flag freezing rain when the freezing level is near the ground", () => {
    expect(classifyPhase({ tC: -1, rh: 95, freezingLevelM: 250, elevationM: 200 })).toBe("snow");
  });
});

describe("slrFor", () => {
  it("returns 13:1 in the dendritic-ish range", () => expect(slrFor(-5, 10)).toBe(13));
  it("returns 10:1 just below freezing", () => expect(slrFor(-1, 10)).toBe(10));
  it("returns 6:1 for wet snow near 0.5 °C", () => expect(slrFor(0.5, 10)).toBe(6));
  it("returns 0 for rain temperatures", () => expect(slrFor(2, 10)).toBe(0));
  it("returns 17:1 in the cold dendritic zone", () => expect(slrFor(-10, 10)).toBe(17));
  it("reduces ratio by 20% when gusts fragment flakes", () => expect(slrFor(-5, 50)).toBeCloseTo(10.4, 5));
});
