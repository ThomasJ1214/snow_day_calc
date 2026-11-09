import { describe, expect, it } from "vitest";
import { decodeGrib2Message, lambertIJ, type LambertGrid } from "../decode";

class BitWriter {
  bytes: number[] = [];
  private cur = 0;
  private n = 0;
  bits(value: number, count: number) {
    for (let i = count - 1; i >= 0; i--) {
      this.cur = (this.cur << 1) | ((value >>> i) & 1);
      if (++this.n === 8) this.flush();
    }
    return this;
  }
  pad() {
    if (this.n) {
      this.cur <<= 8 - this.n;
      this.flush();
    }
    return this;
  }
  u(v: number, octets: number) {
    return this.pad().bits(v, octets * 8);
  }
  s(v: number, octets: number) {
    return this.u((v < 0 ? 1 << (octets * 8 - 1) : 0) | Math.abs(v), octets);
  }
  f32(v: number) {
    const b = new DataView(new ArrayBuffer(4));
    b.setFloat32(0, v);
    for (let i = 0; i < 4; i++) this.u(b.getUint8(i), 1);
    return this;
  }
  private flush() {
    this.bytes.push(this.cur & 0xff);
    this.cur = 0;
    this.n = 0;
  }
}

function section(num: number, body: number[]): number[] {
  const len = body.length + 5;
  return [(len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, num, ...body];
}

const HRRR_GRID: LambertGrid = {
  nx: 1799, ny: 1059, la1: 21.138123, lo1: 237.280472, lov: 262.5, latin1: 38.5, latin2: 38.5, dx: 3000, dy: 3000, radius: 6371229, scanMode: 0x40,
};

function lambertSection(g: { nx: number; ny: number }): number[] {
  const w = new BitWriter();
  w.u(0, 1).u(g.nx * g.ny, 4).u(0, 1).u(0, 1).u(30, 2); // source, npts, optional list, interp, template 3.30
  w.u(6, 1).u(0, 1).u(0, 4).u(0, 1).u(0, 4).u(0, 1).u(0, 4); // earth shape 6 (r = 6371229 m)
  w.u(g.nx, 4).u(g.ny, 4).s(21138123, 4).u(237280472, 4).u(8, 1);
  w.s(38500000, 4).u(262500000, 4).u(3000000, 4).u(3000000, 4).u(0, 1).u(0x40, 1);
  w.s(38500000, 4).s(38500000, 4).s(-90000000, 4).u(0, 4);
  return section(3, w.pad().bytes);
}

function message(sec5: number[], sec7: number[], grid = { nx: 3, ny: 2 }): Uint8Array {
  const sec1 = section(1, [0, 7, 0, 0, 2, 1, 1, 0x07, 0xea, 12, 8, 12, 0, 0, 0, 1]);
  const sec4 = section(4, [0, 0, 0, 8, 1, 29, ...new Array(52).fill(0)]);
  const sec6 = section(6, [255]);
  const body = [...sec1, ...lambertSection(grid), ...sec4, ...section(5, sec5), ...sec6, ...section(7, sec7)];
  const total = 16 + body.length + 4;
  const sec0 = [71, 82, 73, 66, 0, 0, 0, 2, 0, 0, 0, 0, (total >>> 24) & 255, (total >>> 16) & 255, (total >>> 8) & 255, total & 255];
  return new Uint8Array([...sec0, ...body, 55, 55, 55, 55]);
}

describe("GRIB2 simple packing (template 5.0)", () => {
  it("decodes Y = (R + X·2^E) / 10^D", () => {
    const s5 = new BitWriter().u(6, 4).u(0, 2).f32(10).s(0, 2).s(1, 2).u(8, 1).u(0, 1).pad().bytes;
    const s7 = [0, 5, 10, 15, 20, 25];
    const m = decodeGrib2Message(message(s5, s7));
    expect(Array.from(m.values)).toEqual([1, 1.5, 2, 2.5, 3, 3.5]);
    expect(m.grid.nx).toBe(3);
    expect(m.category).toBe(1);
    expect(m.parameter).toBe(29);
    expect(m.refTime.toISOString()).toBe("2026-12-08T12:00:00.000Z");
  });
});

describe("GRIB2 complex packing + 2nd-order spatial differencing (template 5.3)", () => {
  it("reconstructs the original field", () => {
    // f = [10, 12, 15, 20, 24, 31] → 2nd differences [1, 2, -1, 3], gmin = -1 → h = [0, 0, 2, 3, 0, 4]
    const s5 = new BitWriter()
      .u(6, 4).u(3, 2).f32(0).s(0, 2).s(0, 2).u(4, 1).u(0, 1) // npts, template, R, E, D, nbits(ref)=4, type
      .u(1, 1).u(0, 1).u(0, 4).u(0, 4) // split method, missing mgmt 0, substitutes
      .u(2, 4).u(0, 1).u(2, 1) // NG = 2, width ref 0, width bits 2
      .u(3, 4).u(1, 1).u(3, 4).u(1, 1) // length ref 3, increment 1, last length 3, length bits 1
      .u(2, 1).u(2, 1) // order 2, 2 octets per extra descriptor
      .pad().bytes;
    const w = new BitWriter().s(10, 2).s(12, 2).s(-1, 2);
    w.bits(0, 4).bits(0, 4).pad(); // group refs
    w.bits(2, 2).bits(3, 2).pad(); // group widths (2, 3)
    w.bits(0, 1).bits(0, 1).pad(); // scaled group lengths (both 3)
    w.bits(0, 2).bits(0, 2).bits(2, 2).bits(3, 3).bits(0, 3).bits(4, 3).pad();
    const m = decodeGrib2Message(message(s5, w.bytes));
    expect(Array.from(m.values)).toEqual([10, 12, 15, 20, 24, 31]);
  });
});

describe("lambertIJ (HRRR CONUS grid)", () => {
  it("maps the first grid point to (0, 0)", () => {
    const p = lambertIJ(HRRR_GRID, 21.138123, 237.280472 - 360);
    expect(p!.i).toBeCloseTo(0, 1);
    expect(p!.j).toBeCloseTo(0, 1);
  });
  it("places Montville, NJ inside the grid", () => {
    const p = lambertIJ(HRRR_GRID, 40.9154, -74.3638)!;
    expect(p.i).toBeGreaterThan(1500);
    expect(p.i).toBeLessThan(1799);
    expect(p.j).toBeGreaterThan(600);
    expect(p.j).toBeLessThan(1059);
  });
  it("returns null outside the grid", () => expect(lambertIJ(HRRR_GRID, 61.2, -149.9)).toBeNull());
});

import { asnowRange } from "@/lib/weather/hrrr-direct";
describe("asnowRange (.idx lookup)", () => {
  const idx = [
    "64:40000000:d=2026110912:WEASD:surface:0-6 hour acc fcst:",
    "65:40722113:d=2026110912:ASNOW:surface:0-6 hour acc fcst:",
    "66:42386044:d=2026110912:SNOD:surface:6 hour fcst:",
  ].join("\n");
  it("returns the byte range of the 0–N h accumulated snowfall message", () =>
    expect(asnowRange(idx, 6)).toEqual({ start: 40722113, end: 42386043 }));
  it("returns null when the field is absent", () => expect(asnowRange(idx, 12)).toBeNull());
});
