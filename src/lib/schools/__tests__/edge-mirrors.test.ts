import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchJson = vi.fn();
vi.mock("@/lib/server/http", () => ({ fetchJson: (...a: unknown[]) => fetchJson(...a) }));

const { edgeRepo } = await import("../edge-repo");

const MTHS = { NCESSCH: "341065004332", LEAID: "3410650", NAME: "MONTVILLE TOWNSHIP HIGH SCHOOL", STREET: "100 HORSENECK ROAD", CITY: "MONTVILLE", STATE: "NJ", ZIP: "07045", NMCNTY: "Morris County", LOCALE: "21", LAT: 40.8938, LON: -74.3604 };
const INVALID = { error: { code: 400, message: "Cannot perform query. Invalid query parameters." } };

describe("NCES EDGE mirrors", () => {
  beforeEach(() => fetchJson.mockReset());

  it("asks NCES's own server first and stops when it answers", async () => {
    fetchJson.mockResolvedValue({ features: [{ attributes: MTHS }] });
    const s = await edgeRepo.get("pub-341065004332");
    expect(s?.name).toBe("Montville Township High School");
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(String(fetchJson.mock.calls[0][0])).toContain("nces.ed.gov/opengis");
  });

  it("falls back to the next mirror when one returns an ArcGIS error body", async () => {
    fetchJson.mockImplementation(async (url: unknown) => (String(url).includes("nces.ed.gov") ? INVALID : { features: [{ attributes: MTHS }] }));
    const s = await edgeRepo.get("pub-341065004332");
    expect(s?.id).toBe("pub-341065004332");
    expect(fetchJson.mock.calls.some(([u]) => String(u).includes("arcgis.com"))).toBe(true);
  });

  it("retries uncached before giving up, and throws when every mirror fails", async () => {
    fetchJson.mockResolvedValue(INVALID);
    await expect(edgeRepo.get("pub-341065004332")).rejects.toThrow(/Invalid query/);
    const uncached = fetchJson.mock.calls.filter(([, init]) => (init as { revalidate?: number }).revalidate === 0);
    expect(uncached.length).toBeGreaterThan(0);
  });

  it("uses each mirror's own district field names", async () => {
    fetchJson.mockResolvedValue({ features: [] });
    await edgeRepo.search({ q: "montville", state: "NJ" });
    const district = fetchJson.mock.calls.map(([u]) => decodeURIComponent(String(u)).replace(/\+/g, " ")).find((u) => u.includes("PUBLICLEA"));
    expect(district).toContain("UPPER(NAME) LIKE '%MONTVILLE%'");
    expect(district).toContain("STATE='NJ'");
    expect(district).not.toContain("LEA_NAME");
  });
});
