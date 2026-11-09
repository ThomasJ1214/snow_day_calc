"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { RefreshCw, Snowflake, ThermometerSnowflake } from "lucide-react";
import type { LocationForecast } from "./types";
import { SnowStake } from "./snow-stake";
import { Snowfall, snowIntensity } from "@/components/layout/snowfall";
import { WindowsTable } from "./windows-table";
import { AlertsPanel } from "./alerts-panel";
import { SourcesPanel } from "./sources-panel";
import { HourlyStrip } from "./hourly-strip";
import { FavoriteButton, ShareButton, UnitToggle } from "./actions";
import { Notice, Panel, PanelTitle, Skeleton } from "@/components/ui/primitives";
import { LazyMount } from "@/components/ui/lazy-mount";
import { useApi } from "@/lib/client/use-api";
import { useRecents, lastSeen, rememberSeen } from "@/lib/client/storage";
import { fmtCm, fmtDay, fmtIn, fmtLocal, timeAgo, tzAbbr } from "@/lib/client/format";
import { encodeSlug } from "@/lib/geo/slug";

const AccumulationChart = dynamic(() => import("./accumulation-chart").then((m) => m.AccumulationChart), { ssr: false, loading: () => <Skeleton className="h-64" /> });
const SnowMap = dynamic(() => import("@/components/map/snow-map").then((m) => m.SnowMap), { ssr: false, loading: () => <Skeleton className="h-[480px]" /> });

const PHASE_WORD: Record<string, string> = { snow: "snow", mix: "a rain/snow mix", rain: "rain", freezing_rain: "freezing rain" };

export function LocationView({ name, lat, lon }: { name: string; lat: number; lon: number }) {
  const { data: f, error, loading, updatedAt, reload } = useApi<LocationForecast>(`/api/forecast?lat=${lat}&lon=${lon}`, 10 * 60_000);
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const { add } = useRecents();
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const slug = encodeSlug({ name, lat, lon });

  useEffect(() => {
    add({ label: name, href: `/forecast/${slug}` });
  }, [add, name, slug]);

  // Compare with what this browser saw last visit (read before the effect below records the new values).
  const [baseline] = useState(() => (typeof window === "undefined" ? null : lastSeen(key)));
  const change = useMemo(() => {
    if (!f || !baseline) return null;
    const d24 = f.snow.windows["24"].likely - baseline.t24;
    const d72 = f.snow.windows["72"].likely - baseline.t72;
    return Math.abs(d72) >= 1.27 || Math.abs(d24) >= 1.27 ? { d24, d72 } : null;
  }, [f, baseline]);
  useEffect(() => {
    if (f) rememberSeen(key, f.snow.windows["24"].likely, f.snow.windows["72"].likely);
  }, [f, key]);

  const amount = (cm: number) => (unit === "in" ? fmtIn(cm) : fmtCm(cm));
  const snowNarrative = useMemo(() => {
    if (!f) return "";
    const s = f.snow;
    if (!s.startTime) return "No measurable snow is expected in the next 72 hours.";
    return `Snow most likely begins ${fmtLocal(s.startTime, { weekday: "long", hour: "numeric" })} and tapers ${fmtLocal(s.endTime, { weekday: "long", hour: "numeric" })}, heaviest around ${fmtLocal(s.peakTime, { weekday: "short", hour: "numeric" })}.`;
  }, [f]);

  if (error && !f) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">{name}</h1>
        <Notice tone="error" title="The forecast couldn't be loaded">
          {error}{" "}
          <button onClick={reload} className="cursor-pointer font-semibold text-ice underline">
            Try again
          </button>
        </Notice>
      </div>
    );
  }
  if (!f) return <LocationSkeleton name={name} />;

  const s = f.snow;
  const w72 = s.windows["72"];
  const tz = tzAbbr(f.location.timezone, f.location.timezoneAbbr);
  const fav = { type: "location" as const, name, lat, lon, slug };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-sm text-text-3">
            Snowfall forecast{f.location.nwsPlace && f.location.nwsPlace !== name ? ` near ${f.location.nwsPlace}` : ""}, elevation {Math.round(f.location.elevationM * 3.281).toLocaleString()} ft
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">{name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FavoriteButton item={fav} />
            <ShareButton title={`${name} snowfall forecast`} />
            <UnitToggle unit={unit} onChange={setUnit} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-3" aria-live="polite">
          <button onClick={reload} className="neu-press inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-3 hover:text-text">
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Updated {updatedAt ? timeAgo(new Date(updatedAt).toISOString()) : "now"}
            <span className="sr-only">, refresh forecast</span>
          </button>
        </div>
      </section>

      {change && (
        <Notice tone="info" title="The forecast changed since your last visit">
          Next 72 hours {change.d72 > 0 ? "up" : "down"} {fmtIn(Math.abs(change.d72))} to {amount(w72.likely)}.
        </Notice>
      )}
      {f.warnings.map((w) => (
        <Notice key={w} tone="warn" title={w} />
      ))}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel strong className="relative flex gap-5 overflow-hidden sm:gap-8">
          <Snowfall intensity={snowIntensity(s.windows["24"].likely)} />
          <div className="relative w-[38%] max-w-[170px] shrink-0">
            <SnowStake lowCm={w72.low} likelyCm={w72.likely} highCm={w72.high} title="Snow expected in the next 72 hours" />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="text-sm text-text-2">Next 72 hours, most likely</p>
            <p className="font-display text-6xl font-extrabold leading-none tracking-tight tabular sm:text-7xl">{amount(w72.likely)}</p>
            <p className="mt-2 text-text-2 tabular">
              {w72.high === 0 ? (
                "No snow expected"
              ) : (
                <>
                  Range {amount(w72.low)} to {amount(w72.high)} <span className="text-text-3">({unit === "in" ? fmtCm(w72.likely) : fmtIn(w72.likely)})</span>
                </>
              )}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-text-3">Chance of 0.1″+</dt>
                <dd className="font-display text-xl font-semibold tabular">{s.pMeasurable == null ? "—" : `${Math.round(s.pMeasurable * 100)}%`}</dd>
              </div>
              <div>
                <dt className="text-text-3">Confidence</dt>
                <dd className="font-display text-xl font-semibold">
                  {s.confidence.label} <span className="text-sm font-normal text-text-3">{s.confidence.score}/100</span>
                </dd>
              </div>
              <div>
                <dt className="text-text-3">Peak rate</dt>
                <dd className="font-display text-xl font-semibold tabular">{s.peakRateCmH > 0 ? `${amount(s.peakRateCmH)}/h` : "—"}</dd>
              </div>
              <div>
                <dt className="text-text-3">Freezing rain</dt>
                <dd className="font-display text-xl font-semibold tabular">{s.iceRiskMm > 0 ? `${(s.iceRiskMm / 25.4).toFixed(2)}″` : "None"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-text-2">{snowNarrative}</p>
            <p className="mt-1 text-xs text-text-3">{s.confidence.reasons.join(". ")}.</p>
          </div>
        </Panel>

        <Panel>
          <PanelTitle aside={`${f.alerts?.length ?? 0} active`}>National Weather Service alerts</PanelTitle>
          <AlertsPanel alerts={f.alerts} />
          {s.transitions.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ThermometerSnowflake className="size-4 text-violet" aria-hidden /> Precipitation changes
              </h3>
              <ul className="space-y-1 text-sm text-text-2">
                {s.transitions.slice(0, 5).map((t) => (
                  <li key={t.time}>
                    {fmtLocal(t.time, { weekday: "short", hour: "numeric" })}: {PHASE_WORD[t.from]} changing to {PHASE_WORD[t.to]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelTitle aside="Line: most likely. Shading: 10th–90th percentile">Accumulation timeline</PanelTitle>
        <AccumulationChart hourly={s.hourly} unit={unit} />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <WindowsTable snow={s} />
          <div>
            <h3 className="mb-2 text-sm font-medium text-text-3">By day ({tz})</h3>
            <ul className="divide-y divide-line">
              {s.daily.map((d) => (
                <li key={d.date} className="flex items-center justify-between py-2.5 text-sm tabular">
                  <span className="text-text-2">{fmtDay(d.date)}</span>
                  <span>
                    <span className="font-display text-base font-semibold">{amount(d.likelyCm)}</span>
                    <span className="ml-2 text-text-3">
                      {amount(d.lowCm)}–{amount(d.highCm)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelTitle aside={`Times in ${tz}`}>Hour by hour</PanelTitle>
        <HourlyStrip hourly={s.hourly} unit={unit} />
      </Panel>

      <section aria-labelledby="map-h">
        <h2 id="map-h" className="mb-3 font-display text-lg font-semibold">Snowfall map</h2>
        <LazyMount minHeight={560}>
          <SnowMap center={[lon, lat]} zoom={6.2} marker={{ lat, lon, label: name }} />
        </LazyMount>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {f.nwsPeriods && (
          <Panel>
            <PanelTitle aside={f.location.nwsOffice ? `NWS ${f.location.nwsOffice}` : undefined}>Official NWS forecast</PanelTitle>
            <ul className="space-y-3">
              {f.nwsPeriods.slice(0, 6).map((p) => (
                <li key={p.startTime} className="text-sm">
                  <p className="font-semibold text-text">
                    {p.name} <span className="font-normal text-text-3">{p.temperature}°{p.temperatureUnit}</span>
                  </p>
                  <p className="text-text-2">{p.detailedForecast}</p>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <NearbySchools lat={lat} lon={lon} />
      </div>

      <Panel>
        <PanelTitle>Models, sources and limitations</PanelTitle>
        <SourcesPanel f={f} />
        {f.climate && (
          <p className="mt-4 text-sm text-text-3">
            Local snow climate: about {Math.round(f.climate.inches)}″ per year (NOAA 1991–2020 normals from {f.climate.stations.map((st) => st.name.replace(/, [A-Z]{2} US$/, "")).join(", ")}).
          </p>
        )}
      </Panel>
    </div>
  );
}

function NearbySchools({ lat, lon }: { lat: number; lon: number }) {
  const { data, error } = useApi<{ results: { id: string; name: string; district: string | null; type: string; distanceKm?: number }[] }>(`/api/schools/near?lat=${lat}&lon=${lon}`);
  return (
    <Panel>
      <PanelTitle>Schools nearby</PanelTitle>
      {error && <p className="text-sm text-text-3">{error}</p>}
      {!data && !error && <Skeleton className="h-40" />}
      {data && data.results.length === 0 && <p className="text-sm text-text-2">No NCES-listed schools within 8 km. Search for a school by name instead.</p>}
      <ul className="divide-y divide-line">
        {data?.results.slice(0, 8).map((s) => (
          <li key={s.id}>
            <Link href={`/school/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-ice">
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.name}</span>
                <span className="block truncate text-text-3">{s.district ?? (s.type === "private" ? "Private school" : "Public school")}</span>
              </span>
              <span className="shrink-0 text-text-3 tabular">{s.distanceKm != null ? `${(s.distanceKm * 0.621).toFixed(1)} mi` : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function LocationSkeleton({ name }: { name: string }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading forecast">
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{name}</h1>
      <p className="flex items-center gap-2 text-text-3">
        <Snowflake className="size-4 animate-spin" aria-hidden /> Running 80+ model forecasts for this spot…
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

