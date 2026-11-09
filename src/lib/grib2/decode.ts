/**
 * Minimal WMO GRIB2 decoder for NOAA HRRR surface fields.
 * Supports: grid template 3.30 (Lambert conformal), data templates 5.0 (simple packing) and
 * 5.3 (complex packing with spatial differencing, missing-value management 0–2), optional bitmap.
 * Reference: WMO Manual on Codes, FM 92 GRIB Edition 2; NCEP GRIB2 documentation.
 */

export interface LambertGrid {
  nx: number;
  ny: number;
  la1: number;
  lo1: number;
  lov: number;
  latin1: number;
  latin2: number;
  dx: number;
  dy: number;
  radius: number;
  scanMode: number;
}

export interface Grib2Field {
  discipline: number;
  category: number;
  parameter: number;
  refTime: Date;
  grid: LambertGrid;
  /** Grid values in scan order; NaN where missing. */
  values: Float32Array;
}

class Reader {
  constructor(
    private b: Uint8Array,
    private o = 0,
  ) {}
  u(o: number, n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + this.b[this.o + o + i];
    return v;
  }
  /** GRIB2 signed integers are sign-magnitude. */
  s(o: number, n: number): number {
    const v = this.u(o, n);
    const sign = 2 ** (n * 8 - 1);
    return v >= sign ? -(v - sign) : v;
  }
  f32(o: number): number {
    return new DataView(this.b.buffer, this.b.byteOffset + this.o + o, 4).getFloat32(0, false);
  }
}

class BitReader {
  private pos = 0;
  constructor(
    private b: Uint8Array,
    private start: number,
  ) {}
  get bytePos(): number {
    return this.start + Math.ceil(this.pos / 8);
  }
  seekBytes(abs: number) {
    this.start = abs;
    this.pos = 0;
  }
  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const bit = (this.b[this.start + ((this.pos + i) >> 3)] >> (7 - ((this.pos + i) & 7))) & 1;
      v = v * 2 + bit;
    }
    this.pos += n;
    return v;
  }
  align() {
    this.pos = Math.ceil(this.pos / 8) * 8;
  }
}

function parseLambert(r: Reader): LambertGrid {
  const template = r.u(12, 2);
  if (template !== 30) throw new Error(`Unsupported GRIB2 grid template 3.${template}`);
  const shape = r.u(14, 1);
  let radius = 6371229;
  if (shape === 0) radius = 6367470;
  else if (shape === 1) radius = r.u(16, 4) / 10 ** r.u(15, 1);
  return {
    nx: r.u(30, 4),
    ny: r.u(34, 4),
    la1: r.s(38, 4) / 1e6,
    lo1: r.u(42, 4) / 1e6,
    lov: r.u(51, 4) / 1e6,
    dx: r.u(55, 4) / 1e3,
    dy: r.u(59, 4) / 1e3,
    scanMode: r.u(64, 1),
    latin1: r.s(65, 4) / 1e6,
    latin2: r.s(69, 4) / 1e6,
    radius,
  };
}

interface Packing {
  template: number;
  n: number;
  R: number;
  E: number;
  D: number;
  nbits: number;
  sec5: Reader;
}

function unpackSimple(p: Packing, data: Uint8Array, dataStart: number): Float32Array {
  const out = new Float32Array(p.n);
  const e2 = 2 ** p.E;
  const d10 = 10 ** p.D;
  if (p.nbits === 0) return out.fill(p.R / d10);
  const br = new BitReader(data, dataStart);
  for (let i = 0; i < p.n; i++) out[i] = (p.R + br.read(p.nbits) * e2) / d10;
  return out;
}

function unpackComplex(p: Packing, data: Uint8Array, dataStart: number): Float32Array {
  const s5 = p.sec5;
  const missingMgmt = s5.u(22, 1);
  const ng = s5.u(31, 4);
  const widthRef = s5.u(35, 1);
  const widthBits = s5.u(36, 1);
  const lengthRef = s5.u(37, 4);
  const lengthInc = s5.u(41, 1);
  const lastLength = s5.u(42, 4);
  const lengthBits = s5.u(46, 1);
  const order = p.template === 3 ? s5.u(47, 1) : 0;
  const extraOctets = p.template === 3 ? s5.u(48, 1) : 0;

  const r7 = new Reader(data, dataStart);
  let off = 0;
  const firstVals: number[] = [];
  for (let k = 0; k < order; k++) {
    firstVals.push(r7.s(off, extraOctets));
    off += extraOctets;
  }
  const gmin = order > 0 ? r7.s(off, extraOctets) : 0;
  if (order > 0) off += extraOctets;

  const br = new BitReader(data, dataStart + off);
  const refs = new Array<number>(ng);
  for (let g = 0; g < ng; g++) refs[g] = br.read(p.nbits);
  br.align();
  const widths = new Array<number>(ng);
  for (let g = 0; g < ng; g++) widths[g] = widthRef + br.read(widthBits);
  br.align();
  const lengths = new Array<number>(ng);
  for (let g = 0; g < ng; g++) lengths[g] = lengthRef + br.read(lengthBits) * lengthInc;
  lengths[ng - 1] = lastLength;
  br.align();

  const raw = new Float64Array(p.n);
  const missing = new Uint8Array(p.n);
  let idx = 0;
  for (let g = 0; g < ng && idx < p.n; g++) {
    const w = widths[g];
    const allOnesRef = p.nbits > 0 ? 2 ** p.nbits - 1 : -1;
    for (let k = 0; k < lengths[g] && idx < p.n; k++, idx++) {
      if (w === 0) {
        if (missingMgmt > 0 && refs[g] === allOnesRef) missing[idx] = 1;
        raw[idx] = refs[g];
      } else {
        const v = br.read(w);
        if (missingMgmt === 1 && v === 2 ** w - 1) missing[idx] = 1;
        else if (missingMgmt === 2 && v >= 2 ** w - 2) missing[idx] = 1;
        raw[idx] = refs[g] + v;
      }
    }
  }

  if (order > 0) {
    // spatial differencing applies to the non-missing sequence
    const seq: number[] = [];
    for (let i = 0; i < p.n; i++) if (!missing[i]) seq.push(i);
    for (let k = 0; k < order && k < seq.length; k++) raw[seq[k]] = firstVals[k];
    if (order === 1) {
      for (let k = 1; k < seq.length; k++) raw[seq[k]] = raw[seq[k]] + gmin + raw[seq[k - 1]];
    } else if (order === 2) {
      for (let k = 2; k < seq.length; k++) raw[seq[k]] = raw[seq[k]] + gmin + 2 * raw[seq[k - 1]] - raw[seq[k - 2]];
    }
  }

  const out = new Float32Array(p.n);
  const e2 = 2 ** p.E;
  const d10 = 10 ** p.D;
  for (let i = 0; i < p.n; i++) out[i] = missing[i] ? NaN : (p.R + raw[i] * e2) / d10;
  return out;
}

/** Decodes the first field of a single GRIB2 message. */
export function decodeGrib2Message(buf: Uint8Array): Grib2Field {
  if (buf[0] !== 71 || buf[1] !== 82 || buf[2] !== 73 || buf[3] !== 66) throw new Error("Not a GRIB message");
  if (buf[7] !== 2) throw new Error(`Unsupported GRIB edition ${buf[7]}`);
  const discipline = buf[6];
  let pos = 16;
  let grid: LambertGrid | null = null;
  let refTime = new Date(0);
  let category = -1;
  let parameter = -1;
  let packing: Packing | null = null;
  let bitmap: Uint8Array | null = null;
  let values: Float32Array | null = null;

  while (pos < buf.length - 4) {
    if (buf[pos] === 55 && buf[pos + 1] === 55 && buf[pos + 2] === 55 && buf[pos + 3] === 55) break;
    const r = new Reader(buf, pos);
    const len = r.u(0, 4);
    const num = r.u(4, 1);
    if (len <= 0) throw new Error("Corrupt GRIB2 section length");
    switch (num) {
      case 1:
        refTime = new Date(Date.UTC(r.u(12, 2), r.u(14, 1) - 1, r.u(15, 1), r.u(16, 1), r.u(17, 1), r.u(18, 1)));
        break;
      case 3:
        grid = parseLambert(r);
        break;
      case 4:
        category = r.u(9, 1);
        parameter = r.u(10, 1);
        break;
      case 5: {
        const template = r.u(9, 2);
        if (template !== 0 && template !== 2 && template !== 3) throw new Error(`Unsupported GRIB2 data template 5.${template}`);
        packing = { template, n: r.u(5, 4), R: r.f32(11), E: r.s(15, 2), D: r.s(17, 2), nbits: r.u(19, 1), sec5: r };
        break;
      }
      case 6: {
        const ind = r.u(5, 1);
        if (ind === 0) bitmap = buf.subarray(pos + 6, pos + len);
        break;
      }
      case 7: {
        if (!packing) throw new Error("Data section before data representation section");
        values = packing.template === 0 ? unpackSimple(packing, buf, pos + 5) : unpackComplex(packing, buf, pos + 5);
        break;
      }
    }
    pos += len;
  }
  if (!grid || !values || !packing) throw new Error("Incomplete GRIB2 message");

  const total = grid.nx * grid.ny;
  let full = values;
  if (bitmap) {
    full = new Float32Array(total).fill(NaN);
    let k = 0;
    for (let i = 0; i < total; i++) if ((bitmap[i >> 3] >> (7 - (i & 7))) & 1) full[i] = values[k++];
  }
  return { discipline, category, parameter, refTime, grid, values: full };
}

/** Fractional grid indices (i east, j north for scan mode 0x40) of a lat/lon on a Lambert conformal grid. */
export function lambertIJ(g: LambertGrid, lat: number, lon: number): { i: number; j: number } | null {
  const rad = Math.PI / 180;
  const p1 = g.latin1 * rad;
  const p2 = g.latin2 * rad;
  const n =
    Math.abs(g.latin1 - g.latin2) < 1e-6
      ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
  const F = (Math.cos(p1) * Math.tan(Math.PI / 4 + p1 / 2) ** n) / n;
  const rho = (phi: number) => (g.radius * F) / Math.tan(Math.PI / 4 + (phi * rad) / 2) ** n;
  const xy = (la: number, lo: number) => {
    let dl = (((lo - g.lov) % 360) + 540) % 360 - 180;
    dl *= rad;
    const r = rho(la);
    return { x: r * Math.sin(n * dl), y: -r * Math.cos(n * dl) };
  };
  const a = xy(g.la1, g.lo1);
  const b = xy(lat, lon);
  const i = (b.x - a.x) / g.dx;
  let j = (b.y - a.y) / g.dy;
  if (!(g.scanMode & 0x40)) j = -j;
  if (i < -0.5 || j < -0.5 || i > g.nx - 0.5 || j > g.ny - 0.5) return null;
  return { i, j };
}

/** Nearest-grid-cell value at a lat/lon (NaN outside the grid or where missing). */
export function valueAt(field: Grib2Field, lat: number, lon: number): number {
  const p = lambertIJ(field.grid, lat, lon);
  if (!p) return NaN;
  const i = Math.round(p.i);
  const j = Math.round(p.j);
  return field.values[j * field.grid.nx + i];
}
