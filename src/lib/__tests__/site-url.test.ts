import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "../site-url";

describe("resolveSiteUrl", () => {
  it("prefers the configured address and drops a trailing slash", () =>
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://snowdayscout.com/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://snowdayscout.com"));
  it("falls back to the production address Vercel provides", () =>
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "snow-day-calc-s11w.vercel.app" })).toBe("https://snow-day-calc-s11w.vercel.app"));
  it("uses localhost only for local development", () => expect(resolveSiteUrl({})).toBe("http://localhost:3000"));
  it("ignores blank values", () => expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: " ", VERCEL_PROJECT_PRODUCTION_URL: "a.vercel.app" })).toBe("https://a.vercel.app"));
});
