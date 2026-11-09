import "server-only";
import { getHrrrGrids } from "@/lib/weather/hrrr-direct";
import { lambertIJ } from "@/lib/grib2/decode";
import { encodePng, inverseMercatorY, mercatorY } from "./raster";
import { snowColor } from "./scale";

import { OVERLAY_BOUNDS } from "./scale";
const W = 1400;
const H = 820;
const cache = new Map<string, Buffer>();

/** Renders HRRR accumulated snowfall (0–lead h) as a Web-Mercator PNG for a MapLibre image source. */
export async function renderHrrrOverlay(lead: 6 | 12 | 18): Promise<{ png: Buffer; run: string; runTime: string } | null> {
  const grids = await getHrrrGrids();
  const field = grids.fields[lead];
  if (!field) return null;
  const key = `${grids.run}:${lead}`;
  let png = cache.get(key);
  if (!png) {
    const rgba = new Uint8Array(W * H * 4);
    const y0 = mercatorY(OVERLAY_BOUNDS.north);
    const y1 = mercatorY(OVERLAY_BOUNDS.south);
    const { nx, ny } = field.grid;
    for (let py = 0; py < H; py++) {
      const lat = inverseMercatorY(y0 + ((py + 0.5) / H) * (y1 - y0));
      for (let px = 0; px < W; px++) {
        const lon = OVERLAY_BOUNDS.west + ((px + 0.5) / W) * (OVERLAY_BOUNDS.east - OVERLAY_BOUNDS.west);
        const p = lambertIJ(field.grid, lat, lon);
        if (!p) continue;
        const i = Math.min(nx - 1, Math.max(0, Math.round(p.i)));
        const j = Math.min(ny - 1, Math.max(0, Math.round(p.j)));
        const v = field.values[j * nx + i];
        if (!(v > 0)) continue;
        const c = snowColor((v * 100) / 2.54);
        const o = (py * W + px) * 4;
        rgba[o] = c[0];
        rgba[o + 1] = c[1];
        rgba[o + 2] = c[2];
        rgba[o + 3] = c[3];
      }
    }
    png = encodePng(W, H, rgba);
    cache.clear();
    cache.set(key, png);
  }
  return { png, run: grids.run, runTime: grids.runTime.toISOString() };
}
