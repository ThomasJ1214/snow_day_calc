import { describe, expect, it } from "vitest";
import { fmtCm, fmtIn, fmtLocal, riskTone, tzAbbr } from "../format";

describe("format helpers", () => {
  it("formats inches with tenths below 10″ and whole inches above", () => {
    expect(fmtIn(2.54)).toBe("1″");
    expect(fmtIn(12.7)).toBe("5″");
    expect(fmtIn(30.48)).toBe("12″");
    expect(fmtIn(0.1)).toBe("<0.1″");
    expect(fmtIn(0)).toBe("0″");
    expect(fmtIn(null)).toBe("—");
  });
  it("formats centimeters", () => expect(fmtCm(3.14)).toBe("3.1 cm"));
  it("formats local wall-clock times without shifting them", () => expect(fmtLocal("2026-12-08T15:00", { hour: "numeric" })).toBe("3 PM"));
  it("names U.S. timezones by abbreviation", () => {
    expect(["EST", "EDT"]).toContain(tzAbbr("America/New_York", "GMT-5"));
    expect(tzAbbr("Not/AZone", "GMT-5")).toBe("GMT-5");
  });
  it("buckets closure risk", () => {
    expect(riskTone(10)).toBe("low");
    expect(riskTone(80)).toBe("very-high");
  });
});
