/**
 * Builds src/lib/schools/districts.json: NCES LEAID → [district name, official website].
 * Used for district names/websites when the Supabase directory hasn't been imported yet.
 *   npx tsx scripts/build-district-index.ts
 */
import fs from "node:fs";
import path from "node:path";
import { loadDistrictCsv } from "./lib/nces";
import { DISTRICT_WEBSITE_OVERRIDES } from "./lib/overrides";

async function main() {
  const rows = await loadDistrictCsv();
  const out: Record<string, [string, string | null]> = {};
  for (const r of rows) out[r.leaid] = [r.name, DISTRICT_WEBSITE_OVERRIDES[r.leaid] ?? r.website];
  const file = path.join(__dirname, "../src/lib/schools/districts.json");
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`${Object.keys(out).length} districts → ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}
main();
