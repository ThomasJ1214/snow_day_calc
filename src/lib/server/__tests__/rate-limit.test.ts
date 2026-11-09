import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../rate-limit";

describe("rate limiter (token bucket)", () => {
  it("allows up to capacity then blocks", () => {
    const t = 0;
    const rl = createRateLimiter({ capacity: 3, refillPerSec: 1, now: () => t });
    expect([rl("a"), rl("a"), rl("a"), rl("a")]).toEqual([true, true, true, false]);
  });
  it("refills over time and isolates keys", () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 1, refillPerSec: 1, now: () => t });
    expect(rl("a")).toBe(true);
    expect(rl("a")).toBe(false);
    expect(rl("b")).toBe(true);
    t = 1500;
    expect(rl("a")).toBe(true);
  });
});
