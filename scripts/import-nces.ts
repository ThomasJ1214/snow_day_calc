/**
 * Imports the NCES school directory into Supabase (tables from supabase/migrations).
 *
 *   npm run import:nces                 # all states (≈125k schools, ~5–10 minutes)
 *   npm run import:nces -- --state NJ   # one state
 *   npm run import:nces -- --dry-run    # download + transform only, no database writes
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.local or the environment).
 * Sources: NCES EDGE Public/Private School Locations (current) and the CCD LEA directory (district websites).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadDistrictCsv } from "./lib/nces";
import { DISTRICT_WEBSITE_OVERRIDES } from "./lib/overrides";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BASE = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services";
const LAYERS = {
  public: { url: `${BASE}/Public_School_Locations_Current/FeatureServer/0/query`, fields: "NCESSCH,LEAID,NAME,STREET,CITY,STATE,ZIP,NMCNTY,LOCALE,LAT,LON,SCHOOLYEAR" },
  private: { url: `${BASE}/Private_School_Locations_Current/FeatureServer/0/query`, fields: "PPIN,NAME,STREET,CITY,STATE,ZIP,NMCNTY,LOCALE,LAT,LON,SCHOOLYEAR" },
} as const;
const PAGE = 2000;
const BATCH = 1000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const stateArg = args.includes("--state") ? args[args.indexOf("--state") + 1]?.toUpperCase() : null;
if (stateArg && !/^[A-Z]{2}$/.test(stateArg)) throw new Error("--state must be a 2-letter code");

type Attrs = Record<string, string | number | null>;
const title = (s: unknown) =>
  typeof s === "string" ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Of|And|The|For|At)\b/g, (w) => w.toLowerCase()) : null;

async function fetchAll(kind: keyof typeof LAYERS): Promise<Attrs[]> {
  const out: Attrs[] = [];
  const where = stateArg ? `STATE='${stateArg}'` : "1=1";
  for (let offset = 0; ; offset += PAGE) {
    const qs = new URLSearchParams({ where, outFields: LAYERS[kind].fields, returnGeometry: "false", orderByFields: "OBJECTID", resultOffset: String(offset), resultRecordCount: String(PAGE), f: "json" });
    let data: { features?: { attributes: Attrs }[]; exceededTransferLimit?: boolean; error?: { message: string } } | null = null;
    for (let attempt = 0; attempt < 4 && !data; attempt++) {
      try {
        const res = await fetch(`${LAYERS[kind].url}?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        if (data?.error) throw new Error(data.error.message);
      } catch (e) {
        data = null;
        if (attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      }
    }
    const feats = data!.features ?? [];
    out.push(...feats.map((f) => f.attributes));
    process.stdout.write(`\r  ${kind}: ${out.length.toLocaleString()} schools`);
    if (feats.length < PAGE && !data!.exceededTransferLimit) break;
  }
  process.stdout.write("\n");
  return out;
}

async function main() {
  console.log(`NCES import${stateArg ? ` (${stateArg})` : ""}${dryRun ? " — dry run" : ""}`);
  const districtsCsv = (await loadDistrictCsv()).filter((d) => !stateArg || d.state === stateArg);
  const districts = districtsCsv.map((d) => ({
    leaid: d.leaid,
    name: d.name,
    state: d.state,
    city: title(d.city),
    zip: d.zip || null,
    phone: d.phone,
    website: DISTRICT_WEBSITE_OVERRIDES[d.leaid] ?? d.website,
    lea_type: d.leaType,
  }));
  const names = new Map(districts.map((d) => [d.leaid, d.name]));
  console.log(`  districts: ${districts.length.toLocaleString()} (${districts.filter((d) => d.website).length.toLocaleString()} with websites)`);

  const [pub, pvt] = [await fetchAll("public"), await fetchAll("private")];
  const schools = [
    ...pub.map((a) => ({
      id: `pub-${a.NCESSCH}`,
      ncessch: String(a.NCESSCH),
      ppin: null,
      type: "public",
      name: title(a.NAME) ?? "",
      leaid: a.LEAID && names.has(String(a.LEAID)) ? String(a.LEAID) : null,
      district_name: a.LEAID ? (names.get(String(a.LEAID)) ?? null) : null,
      street: title(a.STREET),
      city: title(a.CITY),
      state: String(a.STATE),
      zip: (a.ZIP as string) ?? null,
      county: (a.NMCNTY as string) ?? null,
      lat: Number(a.LAT),
      lon: Number(a.LON),
      locale: a.LOCALE != null ? String(a.LOCALE) : null,
      website: null,
      school_year: (a.SCHOOLYEAR as string) ?? null,
    })),
    ...pvt.map((a) => ({
      id: `pvt-${a.PPIN}`,
      ncessch: null,
      ppin: String(a.PPIN),
      type: "private",
      name: title(a.NAME) ?? "",
      leaid: null,
      district_name: null,
      street: title(a.STREET),
      city: title(a.CITY),
      state: String(a.STATE),
      zip: (a.ZIP as string) ?? null,
      county: (a.NMCNTY as string) ?? null,
      lat: Number(a.LAT),
      lon: Number(a.LON),
      locale: a.LOCALE != null ? String(a.LOCALE) : null,
      website: null,
      school_year: (a.SCHOOLYEAR as string) ?? null,
    })),
  ].filter((s) => s.name && /^[A-Z]{2}$/.test(s.state) && Number.isFinite(s.lat) && Number.isFinite(s.lon));
  const unique = [...new Map(schools.map((s) => [s.id, s])).values()];
  console.log(`  schools ready: ${unique.length.toLocaleString()} (${pub.length.toLocaleString()} public, ${pvt.length.toLocaleString()} private)`);

  if (dryRun) {
    console.log("  sample:", JSON.stringify(unique.find((s) => s.leaid) ?? unique[0]));
    console.log("Dry run complete — nothing written.");
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see README, step 5).");
  const db = createClient(url, key, { auth: { persistSession: false } });

  for (let i = 0; i < districts.length; i += BATCH) {
    const { error } = await db.from("districts").upsert(districts.slice(i, i + BATCH), { onConflict: "leaid" });
    if (error) throw new Error(`districts upsert failed: ${error.message}`);
    process.stdout.write(`\r  wrote districts ${Math.min(i + BATCH, districts.length).toLocaleString()}`);
  }
  process.stdout.write("\n");
  for (let i = 0; i < unique.length; i += BATCH) {
    const { error } = await db.from("schools").upsert(unique.slice(i, i + BATCH), { onConflict: "id" });
    if (error) throw new Error(`schools upsert failed: ${error.message}`);
    process.stdout.write(`\r  wrote schools ${Math.min(i + BATCH, unique.length).toLocaleString()}`);
  }
  process.stdout.write("\n");
  console.log("Import complete.");
}

main().catch((e) => {
  console.error(`\nImport failed: ${e.message}`);
  process.exit(1);
});
