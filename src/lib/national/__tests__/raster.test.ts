import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import { encodePng, snowColor, mercatorY, inverseMercatorY, SNOW_SCALE } from "../raster";

describe("encodePng", () => {
  it("writes a valid RGBA PNG", () => {
    const px = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]);
    const png = encodePng(2, 1, px);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(2);
    expect(png.readUInt32BE(20)).toBe(1);
    const idat = png.indexOf("IDAT");
    const len = png.readUInt32BE(idat - 4);
    const raw = zlib.inflateSync(png.subarray(idat + 4, idat + 4 + len));
    expect([...raw]).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 128]);
  });
});

describe("snowColor", () => {
  it("is transparent below a trace", () => expect(snowColor(0.05)[3]).toBe(0));
  it("uses increasingly intense colors with amount", () => {
    expect(snowColor(1)).not.toEqual(snowColor(12));
    expect(snowColor(30)).toEqual(SNOW_SCALE.at(-1)!.rgba);
  });
});

describe("mercator", () => {
  it("round-trips latitude", () => expect(inverseMercatorY(mercatorY(40.9154))).toBeCloseTo(40.9154, 6));
});
