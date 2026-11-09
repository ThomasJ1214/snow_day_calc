/**
 * Extracts a district's past official weather closures/delays from its Apptegy alert banners
 * (the announcements the district itself posted) into src/lib/history/seed/<leaid>.json.
 *
 *   npx tsx scripts/apptegy-history.ts --leaid 3410650 --parent 3526 --org 14160 --name "Montville Township School District" --site https://www.montville.net
 */
import fs from "node:fs";
import path from "node:path";
import { historyFromBanners, type ApptegyBanner } from "../src/lib/official/apptegy";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  if (i < 0) throw new Error(`--${n} is required`);
  return process.argv[i + 1];
};

async function main() {
  const leaid = arg("leaid");
  const url = `https://cmsv2-static-cdn-prod.apptegy.net/content/${arg("parent")}/${arg("org")}/en/homepage_structure.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const banners = ((await res.json()) as { alert_banners?: ApptegyBanner[] }).alert_banners ?? [];
  const events = historyFromBanners(banners);
  const out = {
    leaid,
    district: arg("name"),
    source: `${arg("site")} (official alert banners, ${url})`,
    extractedAt: new Date().toISOString(),
    note: "Each record is an announcement the district itself published. The date is the school day named in the announcement.",
    events,
  };
  const file = path.join(__dirname, `../src/lib/history/seed/${leaid}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`${events.length} official weather closures/delays → ${path.relative(process.cwd(), file)}`);
  for (const e of events) console.log(`  ${e.date}  ${e.status.padEnd(7)}  ${e.text.slice(0, 90)}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
