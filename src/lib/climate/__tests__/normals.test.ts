import { describe, expect, it } from "vitest";
import { annualSnowNormal } from "../normals";

describe("annualSnowNormal (NOAA 1991–2020 station normals)", () => {
  it("finds Buffalo's lake-effect climatology (~95 in)", () => {
    const n = annualSnowNormal(42.8864, -78.8784);
    expect(n).not.toBeNull();
    expect(n!.inches).toBeGreaterThan(75);
    expect(n!.stations.length).toBeGreaterThan(0);
  });
  it("finds Atlanta's near-zero climatology", () => {
    const n = annualSnowNormal(33.749, -84.388);
    expect(n!.inches).toBeLessThan(4);
  });
  it("returns null far from any station (open ocean)", () => {
    expect(annualSnowNormal(30, -140)).toBeNull();
  });
});
