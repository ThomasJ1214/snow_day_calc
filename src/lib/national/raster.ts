import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Minimal RGBA PNG encoder (8-bit, no filtering). */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Snowfall color scale (inches), icy blues → violet → magenta; shared by map legend and overlays. */
export const SNOW_SCALE: { min: number; label: string; rgba: [number, number, number, number] }[] = [
  { min: 0.1, label: "0.1″", rgba: [186, 230, 253, 150] },
  { min: 1, label: "1″", rgba: [125, 211, 252, 175] },
  { min: 2, label: "2″", rgba: [56, 189, 248, 190] },
  { min: 4, label: "4″", rgba: [59, 130, 246, 200] },
  { min: 6, label: "6″", rgba: [99, 102, 241, 210] },
  { min: 8, label: "8″", rgba: [139, 92, 246, 215] },
  { min: 12, label: "12″", rgba: [168, 85, 247, 225] },
  { min: 18, label: "18″", rgba: [217, 70, 239, 230] },
  { min: 24, label: "24″+", rgba: [244, 114, 182, 235] },
];

export function snowColor(inches: number): [number, number, number, number] {
  let c: [number, number, number, number] = [0, 0, 0, 0];
  for (const s of SNOW_SCALE) if (inches >= s.min) c = s.rgba;
  return c;
}

export const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
export const inverseMercatorY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;
