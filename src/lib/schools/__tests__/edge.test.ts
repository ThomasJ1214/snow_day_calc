import { describe, expect, it } from "vitest";
import { sqlText } from "../edge-repo";
import { parseSchoolId } from "../types";

describe("sqlText (ArcGIS where-clause escaping)", () => {
  it("doubles quotes and strips LIKE wildcards", () => expect(sqlText("O'Brien_%[x]")).toBe("O''BRIEN X"));
  it("neutralises injection attempts", () => expect(sqlText("x' OR 1=1 --")).toBe("X'' OR 1=1 --"));
});
describe("parseSchoolId", () => {
  it("parses public and private ids", () => {
    expect(parseSchoolId("pub-341065004079")).toEqual({ kind: "public", code: "341065004079" });
    expect(parseSchoolId("pvt-A9501234")).toEqual({ kind: "private", code: "A9501234" });
  });
  it("rejects malformed ids", () => {
    expect(parseSchoolId("pub-1;drop")).toBeNull();
    expect(parseSchoolId("abc")).toBeNull();
  });
});

import { nameClause, rankSchools } from "../edge-repo";
describe("nameClause (word-by-word matching)", () => {
  it("requires every word, in any order", () =>
    expect(nameClause("montville high")).toBe("(UPPER(NAME) LIKE '%MONTVILLE%' AND UPPER(NAME) LIKE '%HIGH%')"));
  it("ignores filler words and escapes input", () =>
    expect(nameClause("the o'brien school")).toBe("(UPPER(NAME) LIKE '%O''BRIEN%' AND UPPER(NAME) LIKE '%SCHOOL%')"));
});
describe("rankSchools", () => {
  const s = (name: string, lat: number, lon: number) => ({ name, lat, lon }) as never;
  it("puts nearby matches first when a location is known", () => {
    const ranked = rankSchools([s("Montville High School", 41.46, -72.15), s("Montville Township High School", 40.9, -74.36)], "montville high", { lat: 40.91, lon: -74.36 });
    expect((ranked[0] as { name: string }).name).toBe("Montville Township High School");
  });
  it("ranks names containing every typed word above fuzzy look-alikes", () => {
    const ranked = rankSchools([s("Pleasantville High School", 39.4, -74.5), s("Belleville High School", 40.8, -74.16), s("Montville Township High School", 40.9, -74.36)], "montville high");
    expect((ranked[0] as { name: string }).name).toBe("Montville Township High School");
  });
  it("keeps the source's own order on ties, so typo matches stay where fuzzy search put them", () => {
    const ranked = rankSchools([s("Montville Township High School", 40.9, -74.36), s("Abraham Clark High School", 40.6, -74.2)], "montvile high");
    expect(ranked.map((x) => (x as { name: string }).name)).toEqual(["Montville Township High School", "Abraham Clark High School"]);
  });
});
