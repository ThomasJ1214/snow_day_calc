# SnowDay — Design Spec

Date: 2026-11-09 · Status: approved (user approved design and waived further review gates)

## 1. Intent

A public, account-free website, hosted on Vercel, where anyone in the United States can:

1. See how much snow is coming to a location, with low / most-likely / high ranges derived from real model uncertainty.
2. Find their school and see a transparent closure / delay / early-dismissal probability with the factors explained.
3. See official closure status, always visually and semantically separated from predictions.

Priorities, in order: **accuracy → design → functionality**. No fabricated data, no non-functional controls.

Decisions confirmed by the user:
- School directory stored in **Supabase** (Postgres + `pg_trgm`). The app degrades to live NCES EDGE queries when Supabase is not configured, so it works before the import is run.
- Official status uses a **curated registry** of real district feeds; everywhere else shows "Official information unavailable" with the NCES-listed district website.
- Favorites, recent searches and comparisons are stored in the browser (localStorage). No accounts.
- "Production-ready" = launchable free-tier v1 on Vercel.

## 2. Data sources (verified reachable 2026-11-09)

| Purpose | Source | Notes |
|---|---|---|
| Deterministic forecasts | Open-Meteo `/v1/forecast` with `models=` HRRR (`gfs_hrrr`), NBM (`ncep_nbm_conus`), GFS (`gfs_seamless`), ECMWF (`ecmwf_ifs025`), GEM (`gem_seamless`) | Free, no key. Hourly snowfall, precip, rain, showers, temp, dew point, RH, wind, gusts, visibility, freezing level, weather code. |
| Ensembles | Open-Meteo `/v1/ensemble` (`gfs025` 31 members, `ecmwf_ifs025` 51 members) | Source of low/likely/high percentiles and P(measurable). |
| Climatology | Open-Meteo Archive `/v1/archive` (ERA5) annual snowfall 1991–2020 | Regional preparedness factor. |
| Official forecasts & alerts | NWS `api.weather.gov` `/points`, `/alerts/active?point=` | User-Agent with contact required (env var). |
| National layers | NOAA WPC `mapservices.weather.noaa.gov/vector/rest/services/precip/wpc_prob_winter_precip/MapServer` Day 1–3 snow/ice accumulation and ≥4/8/12″ probability; NOHRSC snow analysis raster | Rendered as ArcGIS export image overlays in MapLibre. |
| Schools | NCES EDGE `Public_School_Locations_Current` (102,178), `Private_School_Locations_Current` (22,510); CCD district directory file (19,637 districts, 16,957 with websites) | Imported into Supabase by `scripts/import-nces.ts`. |
| Geocoding | US Census geocoder (street addresses), Open-Meteo geocoding (city names), Zippopotam.us (ZIP → place), Nominatim reverse (map clicks) | All free. Timezone + elevation from Open-Meteo. |

**RRFS:** NOAA RRFS is published as GRIB2 only; it is not ingested directly. The high-resolution component is HRRR + NBM via Open-Meteo, and the methodology page states this.

## 3. Architecture

```
src/
  lib/
    weather/   open-meteo.ts, ensemble.ts, nws.ts, types.ts
    snow/      wetbulb.ts, slr.ts, phase.ts, accumulate.ts, percentiles.ts, confidence.ts, analyze.ts
    predict/   preparedness.ts, closure.ts
    schools/   repo.ts (interface), supabase-repo.ts, edge-repo.ts, types.ts
    official/  registry.json, verify.ts, status.ts
    geo/       geocode.ts, slug.ts
    server/    rate-limit.ts, http.ts (fetch w/ timeout + retry), cache.ts, errors.ts
    client/    storage.ts (favorites, recents), use-auto-refresh.ts
  app/
    page.tsx                         Home
    forecast/[slug]/page.tsx         Location forecast (slug encodes lat,lon,name)
    school/[id]/page.tsx             School forecast
    national/page.tsx                Nationwide dashboard
    compare/page.tsx                 Compare locations
    saved/page.tsx                   Favorites & recents
    methodology/page.tsx             Sources, models, limitations
    api/forecast, api/geocode, api/schools/search, api/schools/[id],
    api/official/[leaid], api/national/grid, api/alerts
  components/  ui/ (shadcn-style primitives), layout/, forecast/, school/, map/, search/
scripts/import-nces.ts
supabase/migrations/0001_schools.sql
```

Pure computation (`lib/snow`, `lib/predict`, `lib/official/status`) has no I/O and is unit-tested. I/O modules return typed results or typed errors; API routes validate input with zod, rate-limit per IP (token bucket, in-memory per instance), and set `Cache-Control` (`s-maxage=600, stale-while-revalidate=1800` for forecasts; 1 day for schools). The Supabase service key is server-only; only the read-only anon key is ever needed by the server repo.

## 4. Snowfall model

For each hour and each source (deterministic model or ensemble member):

1. **Wet-bulb** from T and RH (Stull 2011).
2. **Precipitation phase**: snow if Tw ≤ 0.5 °C; rain if Tw ≥ 2 °C; mixed between. Freezing rain risk if liquid falls with surface T ≤ 0 °C and freezing level above ~600 m above ground, or model weather code is 56/57/66/67.
3. **Snow-to-liquid ratio** by temperature (Kuchera-style surface approximation): ≥ 1 °C → 0 (rain), 0 to 1 °C → 6:1, −3 to 0 → 10:1, −8 to −3 → 13:1, −14 to −8 → 17:1, colder → 13:1 (smaller crystals), capped by gust > 40 km/h (−20%, fragmentation).
4. **Snow (cm)** = snow-phase liquid (mm) × SLR / 10. Model-reported `snowfall` is used as a cross-check and the lower of the two is used when the phase check disagrees (prevents 10:1 overstatement in marginal air).

Aggregation:
- Accumulation windows 3/6/12/24/48/72 h from "now" in local time.
- Daily totals by local calendar day (timezone from Open-Meteo).
- Start / end = first / last hour with ≥ 0.1 cm/h in the likely series; peak = max hourly rate.
- **Low / likely / high** = 10th / 50th / 90th percentile across ensemble members of each window total. If ensembles are unavailable, use min / median / max across deterministic models and label method `"model-spread"`.
- **P(measurable)** = share of ensemble members with ≥ 0.25 cm (0.1″) in 72 h.
- **Confidence** (0–100): starts at 100 minus normalized ensemble spread ((p90 − p10) / max(likely, 2.5 cm)) and minus lead time penalty (hours to snow onset / 6), clamped; labeled High ≥ 70, Moderate 40–69, Low < 40.
- Elevation (Open-Meteo DEM) is shown; models already use terrain. Lake-effect, coastal storms and banding enter only through the high-resolution models; the UI states that grid-cell forecasts are not street-level certainty.

Change detection: client stores the last seen likely 24 h/72 h totals per location and shows a delta badge when they change by ≥ 0.5″.

## 5. Closure prediction engine

Inputs (school coordinates): overnight snow (6 PM–7 AM local), commute snow (5–8 AM), 24 h total, ice accretion (freezing rain mm), morning low temp, wind chill, max gust, min visibility, active NWS winter alerts.

Preparedness multiplier `m` from 1991–2020 mean annual snowfall `S` (inches):
`m = clamp(0.35 + 0.65 * log10(1 + S) / log10(1 + 60), 0.35, 1.6)` (≈0.4 for Atlanta, ≈1.0 at 60″, up to 1.6 for snow belts). Snow thresholds are multiplied by `m`; cold and ice thresholds are scaled more gently (`sqrt(m)`), since ice disrupts everywhere.

Factor points (each documented, each shown in the UI with its contribution):
- Overnight + commute snow vs scaled thresholds (dominant factor)
- Ice accretion (strong, minimally scaled)
- Wind chill below scaled cold threshold
- Gusts ≥ 50 km/h with snow (blowing snow), visibility < 1 km
- NWS Winter Storm Warning / Ice Storm Warning / Blizzard Warning / Winter Weather Advisory / Extreme Cold Warning

`closure% = 100 · σ(score − 4)`, `delay% = 100 · σ(score − 2.2) · (1 − closure/100) ` adjusted so close + delay ≤ 100. Early-dismissal risk = from snow/ice starting 10 AM–3 PM on the school day. Confidence inherits the snowfall confidence. The engine targets the **next school day** (skips Sat/Sun; holiday calendars not modeled — stated in UI). No historical district data is used or claimed.

## 6. Official status

Statuses: `officially_closed`, `officially_delayed`, `no_cancellation_announced`, `prediction_only`, `unavailable`.

- `registry.json`: `{ leaid, name, feeds: [{ type: "rss" | "page", url }] }`, curated real URLs only.
- `verify.ts` fetches feeds (8 s timeout), considers only items published in the last 18 h, matches closure / delay phrases with negation guards ("no delay", "will be open"), and returns status + evidence (title, link, published) + verified-at.
- No registry entry → `unavailable` with district website link. Registry feed reachable but no matching items → `no_cancellation_announced`. Prediction is always shown as a separate card and never changes the official status.

## 7. UX & visual system

Dark-first glassmorphism with light theme.
- Background `#070B1A` → `#0F172A`, radial aurora gradients (sky `#38BDF8`, violet `#A78BFA` at low opacity).
- Glass card: `bg-white/[0.06] backdrop-blur-xl border-white/[0.12]`; light theme uses white/70.
- Text white / slate-300 / slate-400 (≥ 4.5:1 on the base). Accent ice `#7DD3FC`, violet `#A78BFA`, warning amber, danger rose.
- Fonts: Manrope (display), Inter (body), tabular numerals for data.
- Lucide icons; Recharts (confidence-band area for accumulation, hourly bars); MapLibre GL with CARTO dark basemap.
- Canvas snowfall and Framer Motion entrances, disabled under `prefers-reduced-motion`.
- Touch targets ≥ 44 px, visible focus rings, data-table fallbacks for charts, responsive at 375/768/1024/1440, mobile bottom-sheet navigation.

Pages: Home (hero + unified search for ZIP/city/address/school, use-my-location, national overview, featured snowy areas), Location Forecast, School Forecast, National Dashboard, Compare, Saved, Methodology.

## 8. Errors & missing data

Every module returns `{ ok: true, data } | { ok: false, error: { code, message } }`. Missing models are dropped and listed under "unavailable sources". UI renders explicit empty/error states with retry; never a fabricated number.

## 9. Testing

- Vitest unit tests (written first): wet-bulb, phase, SLR, accumulation windows, timezone-local windows, percentiles, confidence, preparedness, closure engine (incl. regional differences), official status classification & negation guards, slug encoding, rate limiter.
- Integration script hitting live APIs for ZIPs in MA, NY, CO, GA, MN, CA, AK.
- Playwright smoke + screenshots at 390 and 1440 px.
- `tsc --noEmit`, `eslint`, `next build` must pass.

## 10. Out of scope (v1)

User accounts, push notifications, district holiday calendars, direct GRIB2 ingestion (RRFS), historical district closure records.
