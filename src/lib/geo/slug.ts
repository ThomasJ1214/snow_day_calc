import { STATE_NAMES } from "./query";

export interface SlugPlace {
  name: string;
  lat: number;
  lon: number;
}

const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

/** Shareable, human-readable location slug: "buffalo-ny--42.8864_-78.8784". */
export function encodeSlug(p: SlugPlace): string {
  const name =
    p.name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "location";
  return `${name}--${r4(p.lat)}_${r4(p.lon)}`;
}

export function decodeSlug(slug: string): SlugPlace | null {
  const m = decodeURIComponent(slug).match(/^([a-z0-9-]*)--(-?\d{1,3}(?:\.\d+)?)_(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[2]);
  const lon = Number(m[3]);
  if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) return null;
  const words = m[1].split("-").filter(Boolean);
  const last = words.at(-1)?.toUpperCase();
  let name: string;
  if (words.length > 1 && last && STATE_NAMES[last]) {
    name = `${words.slice(0, -1).map(cap).join(" ")}, ${last}`;
  } else {
    name = words.map(cap).join(" ") || "Selected location";
  }
  return { name, lat, lon };
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
