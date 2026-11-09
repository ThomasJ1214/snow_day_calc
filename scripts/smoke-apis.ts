/**
 * Live end-to-end check of the data pipeline (no mocks): geocoding, forecasts, ensembles,
 * NWS, HRRR GRIB2, official status. Run: npm run smoke:apis
 */
import { geocode } from "../src/lib/geo/geocode";
import { getLocationForecast } from "../src/lib/forecast/service";
import { verifyDistrict } from "../src/lib/official/verify";

const ZIPS = [
  ["07045", "Montville, NJ"],
  ["14201", "Buffalo, NY"],
  ["02139", "Cambridge, MA"],
  ["80202", "Denver, CO"],
  ["30303", "Atlanta, GA"],
  ["55401", "Minneapolis, MN"],
  ["94103", "San Francisco, CA"],
  ["99501", "Anchorage, AK"],
] as const;

async function main() {
  let failures = 0;
  for (const [zip, label] of ZIPS) {
    const t = Date.now();
    const g = await geocode(zip);
    if (!g.ok || !g.data.length) {
      console.log(`✗ ${zip} geocode failed`, g.ok ? "no results" : g.error.message);
      failures++;
      continue;
    }
    const p = g.data[0];
    const f = await getLocationForecast(p.lat, p.lon);
    if (!f.ok) {
      console.log(`✗ ${zip} ${label} forecast failed: ${f.error.message}`);
      failures++;
      continue;
    }
    const s = f.data.snow;
    const ok = (id: string) => f.data.sources.find((x) => x.id === id)?.status;
    console.log(
      `✓ ${zip} ${p.name.padEnd(22)} tz=${f.data.location.timezone.padEnd(18)} elev=${Math.round(f.data.location.elevationM)}m ` +
        `72h=${s.windows["72"].low}/${s.windows["72"].likely}/${s.windows["72"].high}cm method=${s.method}(${s.sourceCount}) ` +
        `P=${s.pMeasurable == null ? "-" : Math.round(s.pMeasurable * 100) + "%"} conf=${s.confidence.label} ` +
        `alerts=${f.data.alerts?.length ?? "n/a"} ndfd72=${f.data.ndfd?.totalsCm["72"] ?? "-"} hrrr=${ok("hrrr_grib2")} ` +
        `normal=${f.data.climate?.inches ?? "-"}in nws=${f.data.location.nwsOffice ?? "-"} ${Date.now() - t}ms`,
    );
    if (JSON.stringify(f.data).includes("NaN")) {
      console.log("  ✗ NaN in payload");
      failures++;
    }
  }
  for (const q of ["Montville, NJ", "1 Parsippany Blvd, Parsippany, NJ", "Springfield", "<script>"]) {
    const g = await geocode(q);
    console.log(`geocode "${q}" →`, g.ok ? g.data.slice(0, 3).map((p) => `${p.name} (${p.lat.toFixed(3)},${p.lon.toFixed(3)})`).join(" | ") : `error: ${g.error.code}`);
  }
  const s = await verifyDistrict("3410650", null, { targetDayStartsInHours: 10 });
  console.log(`Montville official status: ${s.status} — ${s.headline} [${s.sourceUrl}]`);
  const none = await verifyDistrict("9999999", "https://example.org");
  console.log(`Unregistered district: ${none.status}`);
  process.exit(failures ? 1 : 0);
}
main();
