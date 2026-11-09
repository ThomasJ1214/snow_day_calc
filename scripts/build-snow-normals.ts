/**
 * Builds src/lib/climate/snow-normals.json from NOAA NCEI 1991–2020 U.S. Climate Normals
 * (annual/seasonal, by station). Keeps stations with a valid ANN-SNOW-NORMAL.
 *
 *   npx tsx scripts/build-snow-normals.ts
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseCsv } from "./lib/nces";

const URL_ =
  "https://www.ncei.noaa.gov/data/normals-annualseasonal/1991-2020/archive/us-climate-normals_1991-2020_v1.0.1_annualseasonal_multivariate_by-station_c20230404.tar.gz";
const DIR = path.join(__dirname, "../data/raw/normals");
const OUT = path.join(__dirname, "../src/lib/climate/snow-normals.json");

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  if (!fs.readdirSync(DIR).some((f) => f.endsWith(".csv"))) {
    console.log("Downloading NOAA normals archive (~54 MB)…");
    const res = await fetch(URL_);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(path.join(DIR, "n.tgz"), Buffer.from(await res.arrayBuffer()));
    execFileSync("tar", ["xzf", "n.tgz"], { cwd: DIR });
  }
  const stations: [number, number, number, string][] = [];
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith(".csv")) continue;
    const rows = parseCsv(fs.readFileSync(path.join(DIR, f), "utf8"));
    if (rows.length < 2) continue;
    const h = rows[0];
    const r = rows[1];
    const snow = parseFloat(r[h.indexOf("ANN-SNOW-NORMAL")]);
    const lat = parseFloat(r[h.indexOf("LATITUDE")]);
    const lon = parseFloat(r[h.indexOf("LONGITUDE")]);
    if (!Number.isFinite(snow) || snow < 0 || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    stations.push([Math.round(lat * 1000) / 1000, Math.round(lon * 1000) / 1000, Math.round(snow * 10) / 10, r[h.indexOf("NAME")].trim()]);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      source: "NOAA NCEI U.S. Climate Normals 1991–2020, annual snowfall (ANN-SNOW-NORMAL), by station",
      fields: ["lat", "lon", "annualSnowIn", "name"],
      stations,
    }),
  );
  console.log(`Wrote ${stations.length} stations to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
