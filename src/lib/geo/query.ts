export type QueryKind = "zip" | "city" | "address" | "coords" | "invalid";

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const NAME_TO_ABBR = Object.fromEntries(Object.entries(STATE_NAMES).map(([k, v]) => [v.toLowerCase(), k]));

export function stateAbbr(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.trim();
  if (STATE_NAMES[v.toUpperCase()]) return v.toUpperCase();
  return NAME_TO_ABBR[v.toLowerCase()] ?? null;
}

export function detectQueryKind(raw: string): QueryKind {
  const q = raw.trim();
  if (q.length < 2 || q.length > 120 || /[<>{}\\]/.test(q)) return "invalid";
  if (/^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(q)) return "coords";
  if (/^\d{5}(-\d{4})?$/.test(q)) return "zip";
  if (/^\d+[a-z]?\s+[a-z0-9]/i.test(q)) return "address";
  return "city";
}

export function parseCityState(raw: string): { city: string; state: string | null } {
  const q = raw.trim().replace(/\s+/g, " ");
  if (q.includes(",")) {
    const [city, ...rest] = q.split(",");
    return { city: city.trim(), state: stateAbbr(rest.join(",").replace(/\b\d{5}\b/, "").trim()) };
  }
  const m = q.match(/^(.*\S)\s+([A-Za-z]{2})$/);
  if (m && STATE_NAMES[m[2].toUpperCase()]) return { city: m[1], state: m[2].toUpperCase() };
  for (const [name, abbr] of Object.entries(NAME_TO_ABBR)) {
    if (q.toLowerCase().endsWith(` ${name}`)) return { city: q.slice(0, q.length - name.length - 1), state: abbr };
  }
  return { city: q, state: null };
}
