export interface School {
  /** 'pub-<NCESSCH>' (public, NCES CCD) or 'pvt-<PPIN>' (private, NCES PSS). */
  id: string;
  type: "public" | "private";
  name: string;
  leaid: string | null;
  district: string | null;
  street: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  county: string | null;
  lat: number;
  lon: number;
  locale: string | null;
  website: string | null;
  districtWebsite: string | null;
  distanceKm?: number;
}

export interface SchoolSearch {
  q?: string;
  state?: string;
  zip?: string;
  limit?: number;
  /** User's location, used to rank nearby schools first. */
  near?: { lat: number; lon: number };
}

export interface SchoolRepo {
  readonly source: "supabase" | "nces-edge";
  search(p: SchoolSearch): Promise<School[]>;
  get(id: string): Promise<School | null>;
  near(lat: number, lon: number, radiusKm: number, limit: number): Promise<School[]>;
}

export const LOCALE_LABELS: Record<string, string> = {
  "11": "City – large", "12": "City – midsize", "13": "City – small",
  "21": "Suburb – large", "22": "Suburb – midsize", "23": "Suburb – small",
  "31": "Town – fringe", "32": "Town – distant", "33": "Town – remote",
  "41": "Rural – fringe", "42": "Rural – distant", "43": "Rural – remote",
};

export function parseSchoolId(id: string): { kind: "public" | "private"; code: string } | null {
  const m = id.match(/^(pub|pvt)-([A-Za-z0-9]{6,14})$/);
  return m ? { kind: m[1] === "pub" ? "public" : "private", code: m[2] } : null;
}
