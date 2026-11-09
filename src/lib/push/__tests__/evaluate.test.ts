import { describe, expect, it } from "vitest";
import { evaluateNotifications, type Target } from "../evaluate";

const prefs = { closureThreshold: 60, snowThresholdIn: 2, notifyOfficial: true, enabled: true };
const school = (over: Partial<Target> = {}): Target => ({
  key: "school:pub-341065004332",
  kind: "school",
  name: "Montville Township High School",
  url: "/school/pub-341065004332",
  localDate: "2026-12-08",
  targetDay: "2026-12-09",
  closurePct: 10,
  delayPct: 5,
  snow24In: 0,
  official: null,
  ...over,
});

describe("evaluateNotifications", () => {
  it("notifies when closure probability reaches the user's threshold", () => {
    const n = evaluateNotifications([school({ closurePct: 72 })], prefs, new Set());
    expect(n).toHaveLength(1);
    expect(n[0].kind).toBe("closure_risk");
    expect(n[0].title).toMatch(/72%/);
  });
  it("does not repeat the same alert on the same local day", () => {
    const sent = new Set(["school:pub-341065004332|closure_risk|2026-12-08"]);
    expect(evaluateNotifications([school({ closurePct: 72 })], prefs, sent)).toHaveLength(0);
  });
  it("always sends an official closure, even below the probability threshold", () => {
    const n = evaluateNotifications([school({ closurePct: 20, official: { status: "officially_closed", headline: "Schools closed Wednesday" } })], prefs, new Set());
    expect(n.map((x) => x.kind)).toEqual(["official"]);
    expect(n[0].body).toContain("Schools closed Wednesday");
  });
  it("notifies for heavy snow at a saved location", () => {
    const n = evaluateNotifications([{ ...school({ kind: "location", key: "loc:40.92,-74.36", name: "Montville, NJ", snow24In: 3.4 }) }], prefs, new Set());
    expect(n[0].kind).toBe("heavy_snow");
  });
  it("sends nothing when notifications are disabled", () => {
    expect(evaluateNotifications([school({ closurePct: 99 })], { ...prefs, enabled: false }, new Set())).toHaveLength(0);
  });
});
