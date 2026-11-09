# SnowDay

**How much snow, and whether school closes — for anywhere in the United States.**

SnowDay is a Next.js website that:

- forecasts snowfall for any U.S. ZIP code, city, street address or map point, with **low / most likely / high** totals taken from 82 ensemble forecast members (not made-up ranges);
- downloads NOAA's high-resolution **HRRR model directly from NOAA's raw GRIB2 files** and draws it on an interactive national map, alongside NOAA Weather Prediction Center snowfall odds and current snow cover;
- predicts **closure, delay and early-dismissal odds for any of ~125,000 U.S. schools** with a transparent, explainable model that adjusts for how snow-ready each region is;
- shows the **official district status** separately from the prediction, read from districts' own announcement feeds (441 districts today, including **Montville Township, NJ**, whose alert banner, calendar and closure history are built in);
- offers optional accounts (Google or email + password, **no confirmation email**), synced favorites, school calendars and push notifications.

Everything works without an account and without any paid service.

---

## Contents

1. [What you need](#1-what-you-need)
2. [Install Node.js and the project](#2-install-nodejs-and-the-project)
3. [Put the code on GitHub](#3-put-the-code-on-github)
4. [Weather data (no setup needed)](#4-weather-data-no-setup-needed)
5. [School database and accounts (Supabase)](#5-school-database-and-accounts-supabase)
6. [Geocoding (no setup needed)](#6-geocoding-no-setup-needed)
7. [Environment variables](#7-environment-variables)
8. [Run it on your computer](#8-run-it-on-your-computer)
9. [Deploy to Vercel](#9-deploy-to-vercel)
10. [Use your own domain](#10-use-your-own-domain)
11. [Test the live site](#11-test-the-live-site)
12. [Ongoing maintenance](#12-ongoing-maintenance)
- [Costs](#costs) · [Troubleshooting](#troubleshooting) · [How it works](#how-it-works) · [Project layout](#project-layout)

---

## 1. What you need

| Software | Why | Get it |
|---|---|---|
| **Node.js 20.9 or newer** (22 LTS recommended) | Runs the website | https://nodejs.org (choose "LTS") |
| **Git** | Downloads and uploads the code | https://git-scm.com/downloads |
| **A GitHub account** (free) | Stores the code; Vercel deploys from it | https://github.com/signup |
| **A Vercel account** (free "Hobby" plan) | Hosts the website | https://vercel.com/signup — sign up *with GitHub* |
| **A Supabase account** (free) — optional | School search database, accounts, notifications | https://supabase.com/dashboard/sign-up |
| A code editor — optional | Editing settings files | https://code.visualstudio.com |

Check the installs worked by opening a terminal (macOS: **Terminal**; Windows: **PowerShell**) and running:

```bash
node --version
```

```bash
git --version
```

`node --version` must print `v20.9.0` or higher.

## 2. Install Node.js and the project

Download the code and install its dependencies:

```bash
git clone https://github.com/ThomasJ1214/snow_day_calc.git
```

```bash
cd snow_day_calc
```

```bash
npm install
```

`npm install` takes 1–3 minutes. Warnings are normal; errors are not (see [Troubleshooting](#troubleshooting)).

## 3. Put the code on GitHub

If you cloned the repository above, it's already on GitHub. To use your own copy instead:

1. Create an empty repository at https://github.com/new (don't add a README).
2. Point your local copy at it and upload (replace `YOUR-NAME/YOUR-REPO`):

```bash
git remote set-url origin https://github.com/YOUR-NAME/YOUR-REPO.git
```

```bash
git push -u origin main
```

## 4. Weather data (no setup needed)

All weather sources are free public services and need **no API keys**:

| Source | What SnowDay uses it for |
|---|---|
| [Open-Meteo](https://open-meteo.com) | NOAA NBM, HRRR, GFS, ECMWF, GEM and ICON hourly forecasts; 82-member GEFS + ECMWF ensembles |
| [NOAA open data (HRRR on AWS)](https://registry.opendata.aws/noaa-hrrr-pds/) | Raw HRRR GRIB2 files decoded by SnowDay for the map |
| [National Weather Service API](https://www.weather.gov/documentation/services-web-api) | Alerts, written forecasts, forecaster snowfall grid |
| [NOAA WPC](https://www.wpc.ncep.noaa.gov/) and [NOHRSC](https://www.nohrsc.noaa.gov/) map services | National snowfall odds and current snow depth layers |
| NOAA NCEI 1991–2020 climate normals (bundled) | How much snow each place normally gets |

**About Open-Meteo's free tier:** it allows about 10,000 requests per day and is for **non-commercial** use. SnowDay snaps locations to a ~2 km grid and caches results, so many users share one request (everyone in Montville shares the same forecast). If your site becomes busy or earns money, buy an API key at https://open-meteo.com/en/pricing and set `OPEN_METEO_API_KEY`.

**About RRFS:** NOAA's next-generation RRFS model isn't published on NOAA's open data service yet. SnowDay checks for it and shows "not yet published" in each forecast's source list; HRRR is used instead.

## 5. School database and accounts (Supabase)

**Optional.** Without Supabase, school search queries the NCES database live (slower name matching, still nationwide), and favorites are stored in each visitor's browser. Supabase adds fast typo-tolerant school search, accounts, synced favorites, school calendars, notifications and closure-history tracking.

### 5a. Create the project

1. Go to https://supabase.com/dashboard → **New project**. Pick a name, a strong database password (save it), and the region closest to your users (e.g. *East US* for New Jersey). Wait ~2 minutes.
2. Open **SQL Editor** → **New query**. Open `supabase/migrations/0001_schools.sql` from this project in a text editor, copy everything, paste, and click **Run**. You should see "Success. No rows returned".
3. Repeat step 2 for `0002_accounts.sql`, then `0003_history.sql` (in that order).

### 5b. Copy your keys

In Supabase → **Project Settings → API** (or **API Keys**), copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` — keep this secret; never put it in client code or share it.

### 5c. Turn off confirmation emails (required)

SnowDay signs people in immediately without any verification email, which also avoids Supabase's email rate limits.

1. Supabase → **Authentication → Sign In / Providers → Email**.
2. Make sure **Enable Email provider** is on.
3. Turn **Confirm email** **off**. Save.

### 5d. Sign in with Google (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create a project → **OAuth consent screen** (External; add your app name and email) → **Credentials → Create credentials → OAuth client ID → Web application**.
2. Under **Authorized redirect URIs** add the callback URL shown in Supabase → Authentication → Sign In / Providers → **Google** (it looks like `https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
3. Copy the Google **Client ID** and **Client secret** into that Supabase Google provider page and enable it.
4. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your site (e.g. `https://snowday.example.com`) and add `https://YOUR-SITE/auth/callback` and `http://localhost:3000/auth/callback` to **Redirect URLs**.

### 5e. Import the school directory

With the three Supabase variables in `.env.local` (step 7), run:

```bash
npm run import:nces
```

It downloads ~125,000 public and private schools and ~19,600 districts from NCES and uploads them (5–10 minutes). Re-run it once a year when NCES publishes new data. To try one state first, or to preview without writing anything:

```bash
npm run import:nces -- --state NJ
```

```bash
npm run import:nces -- --dry-run
```

## 6. Geocoding (no setup needed)

Location search uses free services with no keys: the **U.S. Census Bureau geocoder** (street addresses and map clicks), **Open-Meteo geocoding** (cities) and **Zippopotam.us** (ZIP codes). The browser's own location API powers "Use my location" (the visitor is asked for permission; locations are never stored).

## 7. Environment variables

Copy the template and fill in what you're using:

```bash
cp .env.example .env.local
```

| Variable | Required? | What it is |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Recommended | Your site address, e.g. `https://snowday.example.com` |
| `NWS_CONTACT_EMAIL` | Recommended | Contact email the National Weather Service asks API users to include |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For accounts/fast search | From step 5b |
| `SUPABASE_SERVICE_ROLE_KEY` | For import, cron jobs | From step 5b — **secret** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | For notifications | Generate with `npx web-push generate-vapid-keys`; subject is `mailto:your@email` |
| `CRON_SECRET` | For scheduled jobs | Any long random string, e.g. from `openssl rand -hex 32` |
| `OPEN_METEO_API_KEY` | Optional | Paid Open-Meteo key for heavy or commercial use |

Generate notification keys:

```bash
npx web-push generate-vapid-keys
```

`.env.local` is ignored by Git, so your secrets never get uploaded.

## 8. Run it on your computer

```bash
npm run dev
```

Open http://localhost:3000. Try ZIP `07045` (Montville, NJ) or search "Montville Township High School".

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the 165 automated tests |
| `npm run lint` | Checks code style |
| `npm run typecheck` | Checks TypeScript types |
| `npm run build` then `npm start` | Builds and runs the production version |
| `npm run check` | Lint + types + tests + build, all at once |
| `npm run smoke:apis` | Live end-to-end check of every data source (8 ZIP codes) |
| `npm run smoke:ui` | Screenshots key pages (needs the site running at :3000 and Playwright) |

## 9. Deploy to Vercel

1. Go to https://vercel.com/new and **Import** your GitHub repository.
2. Framework preset: **Next.js** (detected automatically). Leave build settings as they are.
3. Open **Environment Variables** and add each variable from step 7 (same names and values). For `NEXT_PUBLIC_SITE_URL` use your Vercel address for now (e.g. `https://snowday.vercel.app`).
4. Click **Deploy**. The first build takes 2–4 minutes.
5. If you use Supabase, add `https://YOUR-VERCEL-ADDRESS/auth/callback` to Supabase → Authentication → URL Configuration → Redirect URLs, and update **Site URL**.

**Scheduled jobs.** `vercel.json` schedules two daily jobs:

| Job | When (U.S. Eastern) | What it does |
|---|---|---|
| `/api/cron/verify` | ~6:15 AM | Checks every registry district's official feed (Montville first), records verified closures, logs predictions for calibration, pre-warms Montville's forecast |
| `/api/cron/notify` | ~5:30 PM | Sends push notifications for likely snow days and heavy snow |

Vercel's free plan runs each job once a day. For more frequent checks (e.g. every 30 minutes on stormy mornings), use a free scheduler such as https://cron-job.org to call `https://YOUR-SITE/api/cron/notify` and `/api/cron/verify` with the header `Authorization: Bearer YOUR_CRON_SECRET`.

## 10. Use your own domain

1. Buy a domain from any registrar (or in Vercel → **Domains**).
2. Vercel → your project → **Settings → Domains → Add**, and enter your domain.
3. Follow Vercel's instructions to add the DNS record it shows (usually an `A` record to `76.76.21.21`, or a `CNAME` to `cname.vercel-dns.com`) at your registrar. HTTPS is set up automatically within minutes.
4. Update `NEXT_PUBLIC_SITE_URL` in Vercel to the new domain and redeploy; update Supabase's Site URL and Redirect URLs (step 9.5).

## 11. Test the live site

Work through this checklist after each deployment:

- [ ] Home page shows Montville's live snow stake and Montville Township High School's odds.
- [ ] Search `07045`, `Buffalo, NY`, a street address, and `montville high` — each returns results.
- [ ] "Use my location" asks for permission and opens your local forecast.
- [ ] A forecast page shows the chart, the 3–72 hour table, hour-by-hour table, alerts, map and the model list.
- [ ] A school page shows prediction, official status (with source link), calendar and history.
- [ ] The national map draws and the +6/+12/+18 h, 24/48/72 h and "Now" layers switch.
- [ ] Compare two places; save a place and a school; they appear under **Saved**.
- [ ] With Supabase: create an account (no email needed), sign out, sign back in, sign in with Google.
- [ ] With notifications: Account → **Turn on for this device** → **Send a test**.
- [ ] Phone check: layout fits, the bottom navigation works.

You can also hit the data API directly, e.g. `https://YOUR-SITE/api/forecast?lat=40.9154&lon=-74.3638`.

## 12. Ongoing maintenance

| Task | How often | How |
|---|---|---|
| Update the school directory | Yearly (NCES releases each fall) | `npm run import:nces`. If NCES publishes a new district file, set `NCES_LEA_ZIP_URL` to its link from https://nces.ed.gov/ccd/files.asp. Then `npx tsx scripts/build-district-index.ts` and commit. |
| Find more district announcement feeds | Each fall | `npx tsx scripts/discover-feeds.ts --limit 20000` (≈1 hour) and commit `src/lib/official/registry.json`. |
| Refresh Montville's closure history | After each storm season (optional; the daily job also records new ones) | `npx tsx scripts/apptegy-history.ts --leaid 3410650 --parent 3526 --org 14160 --name "Montville Township School District" --site https://www.montville.net` |
| Check Montville prediction accuracy | After a season | `npx tsx --conditions=react-server scripts/backtest.ts --leaid 3410650 --lat 40.9154 --lon -74.3638 --from 2025-12-01 --to 2026-03-15` |
| Update dependencies | Monthly | `npm outdated`, then `npm update` and `npm run check` |
| Watch errors | Weekly in winter | Vercel → project → **Logs** / **Observability** |
| Add a district's calendar or feed manually | As needed | Add an entry to `src/lib/official/registry.json` (`feeds` with an RSS URL, or `calendarIcs`), then deploy |

Climate normals (`src/lib/climate/snow-normals.json`) change only every 10 years: rebuild with `npx tsx scripts/build-snow-normals.ts` when NOAA releases 2001–2030 normals.

## Costs

| Service | Free tier | When you might pay |
|---|---|---|
| Vercel Hobby | Free for personal, non-commercial sites | Commercial use or heavy traffic → Pro plan (see https://vercel.com/pricing) |
| Supabase | Free plan: 500 MB database (the school directory fits comfortably) | Free projects pause after a week without activity; the Pro plan keeps them always on (see https://supabase.com/pricing) |
| Open-Meteo | Free for non-commercial use, ~10,000 calls/day | Commercial use or high traffic → paid API plan (see https://open-meteo.com/en/pricing) |
| NOAA / NWS / NCES / Census / Zippopotam.us / CARTO basemap | Free | — |
| Domain name | — | About $10–20/year |
| Google sign-in | Free | — |

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails with `Cannot read properties of null (reading 'edgesOut')` | A bug in older npm. Run `npx npm@11 install`. |
| `node: command not found` or wrong version | Install Node.js 22 LTS from nodejs.org, then open a new terminal. |
| Forecast pages say "Daily API request limit exceeded" | Open-Meteo's free limit was reached for your server's network. Wait until tomorrow (UTC) or set `OPEN_METEO_API_KEY`. |
| Map area is blank | Run `npm install` again (it copies the map worker to `public/maplibre/`), or `node scripts/copy-maplibre-worker.mjs`. Check that your network allows `basemaps.cartocdn.com`. |
| "Accounts are not configured on this deployment" | Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel, then redeploy. |
| "Account created, but this deployment still requires email confirmation" | Turn off **Confirm email** (step 5c). |
| Google sign-in returns to the sign-in page with an error | Redirect URLs don't match: check step 5d.4 and step 9.5. |
| Import fails with `relation "schools" does not exist` | Run the SQL migrations (step 5a). |
| Notifications: "Push notifications aren't configured" | Add the three VAPID variables and redeploy. On iPhone, add SnowDay to the Home Screen (Share → Add to Home Screen) first. |
| Cron jobs return 401 | `CRON_SECRET` is missing or doesn't match the `Authorization` header. |
| A school's official status is "unavailable" | That district doesn't publish a machine-readable feed SnowDay knows about. The page links to the district website instead. |
| Build fails fetching Google Fonts | Your build machine is offline; Vercel builds have internet access. |

## How it works

See the in-app **How it works** page (`/methodology`) for the full explanation. In short:

- **Snowfall:** for each hour of each model and ensemble member, SnowDay computes the wet-bulb temperature (precipitation type) and a temperature-dependent snow-to-liquid ratio, then takes the 10th/50th/90th percentiles across 82 ensemble members for low/likely/high. Confidence reflects model disagreement and lead time.
- **Closures:** overnight snow, commute snow, ice, wind chill, gusts, visibility and NWS alerts at the school's coordinates, with snow thresholds scaled by local snow climatology from NOAA normals (so 4″ means more in Atlanta than in Buffalo). The next school day skips weekends, federal holidays and district calendar days off. Every factor's contribution is shown.
- **Official status:** read only from sources districts publish themselves; never inferred from a prediction. Old posts (over 18 hours) and phrases like "no delay" or "winter break" are filtered out.

## Project layout

```
src/app/                 pages and API routes (Next.js App Router)
src/components/          UI (forecast, school, map, national, account…)
src/lib/snow/            snowfall physics + ensemble analysis (pure, tested)
src/lib/predict/         closure model (pure, tested)
src/lib/weather/         Open-Meteo, NWS, NDFD, direct HRRR ingestion
src/lib/grib2/           GRIB2 decoder (Lambert grid, complex packing)
src/lib/official/        announcement classifier, feed verifier, Apptegy (Montville), registry
src/lib/calendar/        federal holidays, iCal parsing, next school day
src/lib/schools/         Supabase + NCES EDGE school directory
src/lib/history/         verified closure history + calibration
supabase/migrations/     database schema (run in Supabase SQL editor)
scripts/                 data import, feed discovery, normals, backtest, smoke tests
docs/superpowers/        design spec and implementation plan
```

Data: NOAA/NWS, ECMWF, Environment Canada, DWD (via Open-Meteo), U.S. Department of Education NCES, U.S. Census Bureau. Basemap © OpenStreetMap contributors © CARTO. Closure predictions are estimates — always confirm with your school district.
