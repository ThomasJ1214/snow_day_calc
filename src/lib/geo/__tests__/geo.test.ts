import { describe, expect, it } from "vitest";
import { detectQueryKind, parseCityState, STATE_NAMES } from "../query";
import { encodeSlug, decodeSlug } from "../slug";
import { haversineKm } from "../distance";

describe("detectQueryKind", () => {
  it.each([
    ["02139", "zip"],
    ["02139-4307", "zip"],
    ["Boston, MA", "city"],
    ["Buffalo NY", "city"],
    ["Denver", "city"],
    ["1600 Pennsylvania Ave NW, Washington, DC", "address"],
    ["12 Main St Burlington VT 05401", "address"],
    ["42.36, -71.06", "coords"],
  ])("%s → %s", (q, kind) => expect(detectQueryKind(q)).toBe(kind));

  it("rejects empty, too-long and markup input", () => {
    expect(detectQueryKind("")).toBe("invalid");
    expect(detectQueryKind("a".repeat(300))).toBe("invalid");
    expect(detectQueryKind("<script>alert(1)</script>")).toBe("invalid");
  });
});

describe("parseCityState", () => {
  it("splits city and state abbreviation", () => expect(parseCityState("Boston, MA")).toEqual({ city: "Boston", state: "MA" }));
  it("accepts full state names", () => expect(parseCityState("Springfield, Illinois")).toEqual({ city: "Springfield", state: "IL" }));
  it("handles no state", () => expect(parseCityState("Denver")).toEqual({ city: "Denver", state: null }));
  it("knows all 50 states plus DC", () => expect(Object.keys(STATE_NAMES).length).toBe(51));
});

describe("slug", () => {
  it("round-trips coordinates and name", () => {
    const slug = encodeSlug({ name: "Buffalo, NY", lat: 42.8864, lon: -78.8784 });
    expect(slug).toMatch(/^buffalo-ny--42\.8864_-78\.8784$/);
    expect(decodeSlug(slug)).toEqual({ name: "Buffalo, NY", lat: 42.8864, lon: -78.8784 });
  });
  it("returns null for invalid slugs", () => {
    expect(decodeSlug("nonsense")).toBeNull();
    expect(decodeSlug("x--999_0")).toBeNull();
  });
});

describe("haversineKm", () => {
  it("Boston→NYC ≈ 306 km", () => expect(haversineKm(42.3601, -71.0589, 40.7128, -74.006)).toBeCloseTo(306, -1));
});
