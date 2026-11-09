import { describe, expect, it } from "vitest";
import { snowIntensity } from "../snowfall";

describe("snowIntensity (on-screen snow follows the real forecast)", () => {
  it("keeps a quiet baseline when no snow is forecast", () => expect(snowIntensity(0)).toBeCloseTo(0.08, 5));
  it("grows with forecast snowfall", () => expect(snowIntensity(7.5)).toBeGreaterThan(snowIntensity(2.5)));
  it("caps at full intensity for heavy snow", () => expect(snowIntensity(40)).toBe(1));
});
