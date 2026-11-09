import { describe, expect, it } from "vitest";
import { snap } from "../open-meteo";

describe("snap (shared ~2 km cache grid)", () => {
  it("rounds to 0.02°", () => {
    expect(snap(40.9154)).toBe(40.92);
    expect(snap(-74.3638)).toBe(-74.36);
  });
  it("maps all of Montville's schools onto very few cells", () => {
    const pts = [[40.8997, -74.3577], [40.9107, -74.37], [40.9154, -74.3638], [40.9114, -74.3587]];
    expect(new Set(pts.map(([a, b]) => `${snap(a)},${snap(b)}`)).size).toBeLessThanOrEqual(3);
  });
});
