/**
 * Backtests the closure engine against a district's real decisions using archived model forecasts
 * (Open-Meteo Historical Forecast API). For every school day in the given winters with forecast
 * snow or ice, it replays the forecast available the evening before and compares the predicted
 * closure probability with the verified outcome (src/lib/history/seed/<leaid>.json).
 *
 *   npx tsx --conditions=react-server scripts/backtest.ts --leaid 3410650 --lat 40.9154 --lon -74.3638 --from 2024-12-01 --to 2025-03-15
 */
import { analyzeSnow } from "../src/lib/snow/analyze";
import { closureInputsForDay } from "../src/lib/predict/inputs";
import { predictClosure } from "../src/lib/predict/closure";
import { annualSnowNormal } from "../src/lib/climate/normals";
import { addDays, weekday } from "../src/lib/calendar/dates";
import { brierScore } from "../src/lib/history/brier";
import { SEED_HISTORY } from "../src/lib/history/seed";
import type { HourlySeries } from "../src/lib/weather/types";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  if (i > -1) return process.argv[i + 1];
  if (d != null) return d;
  throw new Error(`--${n} required`);
};
const MODELS = ["ncep_nbm_conus", "gfs_hrrr", "gfs_seamless", "ecmwf_ifs025"];
const VARS = ["precipitation", "snowfall", "temperature_2m", "relative_humidity_2m", "wind_gusts_10m", "wind_speed_10m", "visibility", "weather_code"];
const KEY = process.env.OPEN_METEO_API_KEY;

async function main() {
  const leaid = arg("leaid");
  const lat = Number(arg("lat"));
  const lon = Number(arg("lon"));
  const from = arg("from");
  const to = arg("to");
  const host = KEY ? "https://customer-historical-forecast-api.open-meteo.com" : "https://historical-forecast-api.open-meteo.com";
  const url = `${host}/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${addDays(from, -1)}&end_date=${to}&hourly=${VARS.join(",")}&models=${MODELS.join(",")}&timezone=auto${KEY ? `&apikey=${KEY}` : ""}`;
  const res = await fetch(url);
  const d = await res.json();
  if (d.error) throw new Error(d.reason);
  const time: string[] = d.hourly.time;
  const series: Record<string, HourlySeries> = {};
  const F: Record<string, keyof HourlySeries> = { precipitation: "precipMm", snowfall: "snowfallCm", temperature_2m: "tempC", relative_humidity_2m: "rh", wind_gusts_10m: "gustKmh", wind_speed_10m: "windKmh", visibility: "visibilityM", weather_code: "weatherCode" };
  for (const m of MODELS) {
    const s = { time } as HourlySeries;
    for (const v of VARS) (s[F[v]] as unknown) = d.hourly[`${v}_${m}`] ?? time.map(() => null);
    if (s.precipMm.some((x) => x != null)) series[m] = s;
  }
  const outcomes = new Map((SEED_HISTORY[leaid]?.events ?? []).map((e) => [e.date, e.status]));
  const normal = annualSnowNormal(lat, lon)?.inches ?? null;
  const rows: { date: string; p: number; delay: number; o: string; snow: number; ice: number }[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (weekday(day) === 0 || weekday(day) === 6) continue;
    const nowIndex = time.indexOf(`${addDays(day, -1)}T18:00`);
    if (nowIndex < 0) continue;
    const a = analyzeSnow({ deterministic: series, ensemble: [], nowIndex, primaryOrder: MODELS });
    const w = closureInputsForDay(a.hourly, day);
    if (!w || (w.overnightSnowIn + w.commuteSnowIn < 0.1 && w.iceIn === 0 && !outcomes.has(day))) continue;
    const p = predictClosure({ ...w, alerts: [], annualSnowIn: normal, confidence: a.confidence.score });
    rows.push({ date: day, p: p.closurePct, delay: p.delayPct, o: outcomes.get(day) ?? "open", snow: Math.round((w.overnightSnowIn + 0.5 * w.commuteSnowIn) * 10) / 10, ice: Math.round(w.iceIn * 100) / 100 });
  }
  console.log(`date        snow(in) ice(in)  P(close) P(delay)  actual`);
  for (const r of rows) console.log(`${r.date}  ${String(r.snow).padStart(7)}  ${String(r.ice).padStart(6)}  ${String(r.p).padStart(7)}%  ${String(r.delay).padStart(6)}%  ${r.o}`);
  const pairs = rows.map((r) => ({ p: r.p / 100, o: (r.o === "closed" ? 1 : 0) as 0 | 1 }));
  console.log("Note: archived forecasts are the best available model data for each hour, so this is an optimistic (near-analysis) replay.");
  console.log(`\nDays scored: ${rows.length}; Brier score (closure): ${pairs.length ? brierScore(pairs).toFixed(3) : "n/a"} (0 = perfect, 0.25 = coin flip)`);
}
main().catch((e) => {
  console.error("Backtest failed:", e.message);
  process.exit(1);
});
