import { describe, expect, it } from "vitest";
import { preparednessMultiplier } from "../preparedness";
import { predictClosure, type ClosureInput } from "../closure";

const calm: ClosureInput = {
  overnightSnowIn: 0,
  commuteSnowIn: 0,
  totalSnow24In: 0,
  iceIn: 0,
  morningLowF: 40,
  windChillF: 38,
  maxGustMph: 8,
  minVisibilityMi: 10,
  alerts: [],
  annualSnowIn: 30,
  dismissalWindowSnowIn: 0,
  confidence: 80,
};

describe("preparednessMultiplier", () => {
  it("is 0.35 where it never snows", () => expect(preparednessMultiplier(0)).toBeCloseTo(0.35, 5));
  it("is 1.0 at 60 inches per year", () => expect(preparednessMultiplier(60)).toBeCloseTo(1.0, 5));
  it("never exceeds 1.6", () => expect(preparednessMultiplier(400)).toBeLessThanOrEqual(1.6));
  it("increases with climatological snowfall", () =>
    expect(preparednessMultiplier(95)).toBeGreaterThan(preparednessMultiplier(2)));
});

describe("predictClosure", () => {
  it("predicts ~0% with no adverse weather", () => {
    const p = predictClosure(calm);
    expect(p.closurePct).toBeLessThanOrEqual(3);
    expect(p.delayPct).toBeLessThanOrEqual(5);
    expect(p.earlyDismissal).toBe("low");
  });

  it("closes Atlanta-like climates for 4 inches overnight", () => {
    const p = predictClosure({ ...calm, overnightSnowIn: 4, commuteSnowIn: 1, totalSnow24In: 4, morningLowF: 28, annualSnowIn: 2 });
    expect(p.closurePct).toBeGreaterThanOrEqual(70);
  });

  it("does not usually close Buffalo-like climates for the same 4 inches", () => {
    const p = predictClosure({ ...calm, overnightSnowIn: 4, commuteSnowIn: 1, totalSnow24In: 4, morningLowF: 28, annualSnowIn: 95 });
    expect(p.closurePct).toBeLessThanOrEqual(35);
    expect(p.delayPct).toBeGreaterThan(p.closurePct);
  });

  it("treats a quarter inch of ice as disruptive in any climate", () => {
    for (const annualSnowIn of [2, 95]) {
      const p = predictClosure({ ...calm, iceIn: 0.25, morningLowF: 30, annualSnowIn });
      expect(p.closurePct).toBeGreaterThanOrEqual(60);
    }
  });

  it("keeps closure + delay at or below 100", () => {
    const p = predictClosure({ ...calm, overnightSnowIn: 14, commuteSnowIn: 4, totalSnow24In: 18, iceIn: 0.3, alerts: ["Blizzard Warning"], annualSnowIn: 10 });
    expect(p.closurePct + p.delayPct).toBeLessThanOrEqual(100);
    expect(p.closurePct).toBeGreaterThanOrEqual(95);
  });

  it("raises probability for NWS winter warnings", () => {
    const base = predictClosure({ ...calm, overnightSnowIn: 3, commuteSnowIn: 1, totalSnow24In: 3 });
    const warned = predictClosure({ ...calm, overnightSnowIn: 3, commuteSnowIn: 1, totalSnow24In: 3, alerts: ["Winter Storm Warning"] });
    expect(warned.closurePct).toBeGreaterThan(base.closurePct);
  });

  it("closes cold-adapted regions only for extreme wind chills", () => {
    const mild = predictClosure({ ...calm, windChillF: -10, morningLowF: 5, annualSnowIn: 50 });
    const extreme = predictClosure({ ...calm, windChillF: -45, morningLowF: -25, annualSnowIn: 50, alerts: ["Extreme Cold Warning"] });
    expect(mild.closurePct).toBeLessThan(15);
    expect(extreme.closurePct).toBeGreaterThan(50);
  });

  it("flags early dismissal risk for snow during the school day", () => {
    const p = predictClosure({ ...calm, dismissalWindowSnowIn: 4, annualSnowIn: 20 });
    expect(p.earlyDismissal).toBe("high");
  });

  it("explains itself: factor points sum to the score", () => {
    const p = predictClosure({ ...calm, overnightSnowIn: 5, commuteSnowIn: 2, totalSnow24In: 6, maxGustMph: 40, minVisibilityMi: 0.3, alerts: ["Winter Storm Warning"] });
    const sum = p.factors.reduce((a, f) => a + f.points, 0);
    expect(sum).toBeCloseTo(p.score, 5);
    expect(p.factors.length).toBeGreaterThan(2);
    for (const f of p.factors) expect(f.detail.length).toBeGreaterThan(5);
  });

  it("uses a neutral multiplier and says so when climatology is unavailable", () => {
    const p = predictClosure({ ...calm, annualSnowIn: null, overnightSnowIn: 3 });
    expect(p.multiplier).toBe(1);
    expect(p.notes.join(" ")).toMatch(/climat/i);
  });
});
