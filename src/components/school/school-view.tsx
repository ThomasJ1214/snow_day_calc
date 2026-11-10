"use client";
import Link from "next/link";
import { CalendarOff, History, MapPin, RefreshCw } from "lucide-react";
import type { SchoolPrediction } from "@/components/forecast/types";
import { OfficialCard } from "./official-card";
import { OddsBar } from "./odds-bar";
import { TweenNumber } from "@/components/ui/tween-number";
import { m } from "framer-motion";
import { REVEAL } from "@/components/ui/motion";
import { SnowStake } from "@/components/forecast/snow-stake";
import { FavoriteButton, ShareButton } from "@/components/forecast/actions";
import { Notice, Panel, PanelTitle, Pill, Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/client/use-api";
import { cToF, fmtDay, fmtIn, fmtLocal, kmhToMph, mToMi, timeAgo } from "@/lib/client/format";
import { encodeSlug } from "@/lib/geo/slug";
import { LOCALE_LABELS, type School } from "@/lib/schools/types";
import { useEffect } from "react";
import { useRecents } from "@/lib/client/storage";

/** "SCHOOLS CLOSED - Thanksgiving Recess - District (HW-Free break)" → "Thanksgiving Recess" */
function cleanReason(r: string): string {
  const t = r
    .replace(/\(.*?\)/g, "")
    .replace(/^\s*schools?\s+closed\s*[-–:]\s*/i, "")
    .replace(/\s*[-–]\s*district\s*$/i, "")
    .trim();
  return t || r;
}

export function SchoolView({ id, initialSchool }: { id: string; initialSchool: School | null }) {
  const { data: p, error, loading, updatedAt, reload } = useApi<SchoolPrediction>(`/api/school-forecast/${id}`, 10 * 60_000);
  const { add } = useRecents();
  useEffect(() => {
    if (p) add({ label: p.school.name, href: `/school/${id}` });
  }, [p, add, id]);

  if (error && !p)
    return (
      <Notice tone="error" title="This school's forecast couldn't be loaded">
        {error}{" "}
        <button onClick={reload} className="cursor-pointer font-semibold text-ice underline">
          Try again
        </button>
      </Notice>
    );
  if (!p)
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading prediction">
        {initialSchool ? <SchoolHeader s={initialSchool} fav={favOf(initialSchool)} refresh={null} /> : <Skeleton className="h-36 w-2/3" />}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Skeleton className="h-[244px]" />
          <Skeleton className="h-[244px]" />
        </div>
        <Skeleton className="h-[184px]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[470px]" />
          <Skeleton className="h-[244px]" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[290px]" />
          <Skeleton className="h-[480px]" />
        </div>
      </div>
    );

  const s = p.school;
  const w = p.weather;
  const pred = p.prediction;
  const commute = p.forecast.snow.hourly.filter((h) => h.time.startsWith(p.targetDay) && Number(h.time.slice(11, 13)) >= 5 && Number(h.time.slice(11, 13)) <= 8);
  const w24 = p.forecast.snow.windows["24"];
  const fav = favOf(s);
  const maxPts = Math.max(1, ...(pred?.factors.map((f) => f.points) ?? [1]));

  return (
    <div className="space-y-6">
      <SchoolHeader s={s} fav={fav} refresh={<RefreshButton loading={loading} updatedAt={updatedAt} onClick={reload} />} />
      <m.div {...REVEAL} className="space-y-6">

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel strong>
          <p className="text-sm text-text-2">Snow Day Scout prediction for {p.targetDayLabel}</p>
          {pred ? (
            <>
              <div className="mt-4">
                <OddsBar closure={pred.closurePct} delay={pred.delayPct} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone={pred.earlyDismissal === "high" ? "rose" : pred.earlyDismissal === "moderate" ? "amber" : "neutral"}>Early dismissal risk: {pred.earlyDismissal}</Pill>
                <Pill tone="ice">Forecast confidence: {p.forecast.snow.confidence.label.toLowerCase()}</Pill>
                <Pill>Local snow-readiness ×{pred.multiplier.toFixed(2)}</Pill>
              </div>
            </>
          ) : (
            <p className="mt-4 text-text-2">{p.notes[0]}</p>
          )}
          {p.calendar.skipped.length > 0 && (
            <p className="mt-4 text-sm text-text-3">Skipped {p.calendar.skipped.map((d) => `${fmtDay(d.date)} (${d.reason})`).join(", ")}.</p>
          )}
        </Panel>
        <OfficialCard s={p.official} />
      </div>

      {pred && (
        <Panel>
          <PanelTitle aside={`Score ${pred.score.toFixed(1)}`}>Why this prediction</PanelTitle>
          {pred.factors.length === 0 ? (
            <p className="text-text-2">No snow, ice, dangerous cold or winter alerts are forecast for the overnight hours or morning commute.</p>
          ) : (
            <ul className="space-y-3">
              {pred.factors.map((f) => (
                <li key={f.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-text">{f.label}</span>
                    <span className="text-text-3 tabular">+{f.points.toFixed(1)}</span>
                  </div>
                  <div className="neu-inset-sm mt-1.5 h-2.5 rounded-full p-0.5">
                    <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(f.points / maxPts) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-sm text-text-2">{f.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-text-3">
            Points add up to a score that maps to probabilities through a fixed curve. Snow thresholds scale with how much snow this area normally gets, so the same storm
            counts for more where it rarely snows. {pred.notes.join(" ")}{" "}
            <Link href="/methodology#closure" className="text-ice underline">
              How the model works
            </Link>
          </p>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel>
          <PanelTitle>Weather for the school morning</PanelTitle>
          {w ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
              {[
                ["Overnight snow", fmtIn(w.overnightSnowIn * 2.54), "6 PM to 7 AM"],
                ["Commute snow", fmtIn(w.commuteSnowIn * 2.54), "5 to 8 AM"],
                ["24-hour snow", fmtIn(w.totalSnow24In * 2.54), "from 6 PM"],
                ["Freezing rain", w.iceIn > 0 ? `${w.iceIn.toFixed(2)}″` : "None", "overnight"],
                ["Morning low", `${Math.round(w.morningLowF)}°F`, `wind chill ${Math.round(w.windChillF)}°F`],
                ["Visibility", w.minVisibilityMi == null ? "—" : `${Math.min(10, w.minVisibilityMi).toFixed(1)} mi`, `gusts ${Math.round(w.maxGustMph)} mph`],
              ].map(([k, v, sub]) => (
                <div key={k}>
                  <dt className="text-text-3">{k}</dt>
                  <dd className="font-display text-xl font-semibold tabular">{v}</dd>
                  <dd className="text-xs text-text-3">{sub}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-text-2">Not yet in forecast range.</p>
          )}
          {commute.length > 0 && (
            <div className="mt-5 overflow-x-auto border-t border-line pt-4">
              <h3 className="mb-2 text-sm font-medium text-text-3">Morning commute, {fmtDay(p.targetDay)}</h3>
              <table className="w-full text-sm tabular">
                <thead className="text-left text-text-3">
                  <tr>
                    <th className="py-1 font-medium">Time</th>
                    <th className="py-1 font-medium">Snow/h</th>
                    <th className="py-1 font-medium">Temp</th>
                    <th className="py-1 font-medium">Gusts</th>
                    <th className="py-1 font-medium">Visibility</th>
                  </tr>
                </thead>
                <tbody>
                  {commute.map((h) => (
                    <tr key={h.time} className="border-t border-line">
                      <td className="py-1.5">{fmtLocal(h.time, { hour: "numeric" })}</td>
                      <td className="py-1.5">{fmtIn(h.rateLikely)}</td>
                      <td className="py-1.5">{h.tempC == null ? "—" : `${cToF(h.tempC)}°F`}</td>
                      <td className="py-1.5">{h.gustKmh == null ? "—" : `${kmhToMph(h.gustKmh)} mph`}</td>
                      <td className="py-1.5">{h.visibilityM == null ? "—" : `${Math.min(10, mToMi(h.visibilityM)).toFixed(1)} mi`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel className="flex gap-6">
          <div className="w-32 shrink-0">
            <SnowStake lowCm={w24.low} likelyCm={w24.likely} highCm={w24.high} height={220} title="Snow in the next 24 hours" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text-2">Next 24 hours at this school</p>
            <p className="font-display text-5xl font-extrabold tabular">
              <TweenNumber value={w24.likely} format={fmtIn} />
            </p>
            <p className="text-text-2 tabular">{w24.high === 0 ? "No snow expected" : `Range ${fmtIn(w24.low)} to ${fmtIn(w24.high)}`}</p>
            {(p.forecast.alerts ?? []).length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {p.forecast.alerts!.map((a) => (
                  <li key={a.id} className="font-semibold text-violet">
                    {a.event}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel>
          <PanelTitle>
            <span className="inline-flex items-center gap-2">
              <CalendarOff className="size-5 text-ice" aria-hidden /> School calendar
            </span>
          </PanelTitle>
          <p className="text-sm text-text-3">Using: {p.calendar.sources.join("; ")}.</p>
          {p.calendar.upcomingNoSchool.length > 0 ? (
            <ul className="mt-3 divide-y divide-line text-sm">
              {p.calendar.upcomingNoSchool.map((d) => (
                <li key={d.date} className="flex min-w-0 justify-between gap-3 py-2">
                  <span className="shrink-0 text-text-2">{fmtDay(d.date)}</span>
                  <span className="min-w-0 truncate text-right text-text">{cleanReason(d.reason)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-2">No scheduled days off in the next 30 days from the calendars above.</p>
          )}
          <p className="mt-3 text-sm text-text-3">
            Have your school&apos;s calendar link?{" "}
            <Link href="/account#calendars" className="text-ice underline">
              Add it in your account
            </Link>{" "}
            so holidays and breaks are skipped.
          </p>
        </Panel>

        <Panel>
          <PanelTitle>
            <span className="inline-flex items-center gap-2">
              <History className="size-5 text-violet" aria-hidden /> Past closures
            </span>
          </PanelTitle>
          {p.history ? (
            <>
              <table className="w-full text-sm tabular">
                <thead className="text-left text-text-3">
                  <tr>
                    <th className="py-1 font-medium">School year</th>
                    <th className="py-1 font-medium">Weather closures</th>
                    <th className="py-1 font-medium">Delays</th>
                  </tr>
                </thead>
                <tbody>
                  {p.history.seasons.map((r) => (
                    <tr key={r.season} className="border-t border-line">
                      <td className="py-1.5">{r.season}</td>
                      <td className="py-1.5">{r.closed}</td>
                      <td className="py-1.5">{r.delayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="mt-3 space-y-2 text-sm">
                {p.history.events.slice(0, 5).map((e) => (
                  <li key={`${e.date}${e.status}`}>
                    <span className="font-semibold text-text">
                      {fmtDay(e.date, { month: "short", day: "numeric", year: "numeric" })}: {e.status === "closed" ? "closed" : "delayed opening"}
                    </span>
                    <span className="block truncate text-text-3">{e.evidence}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-text-3">
                Only announcements the district itself published.{" "}
                {p.history.calibration ? `Prediction accuracy (Brier score) over ${p.history.calibration.n} days: ${p.history.calibration.brier}.` : "Accuracy tracking starts once 10 predicted days can be checked."}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-2">No verified closure history for this district yet. Snow Day Scout records official announcements as its verifier confirms them.</p>
          )}
        </Panel>
      </div>

      {p.notes.slice(pred ? 0 : 1).map((n) => (
        <Notice key={n} tone="info" title={n} />
      ))}
      </m.div>
    </div>
  );
}

const favOf = (s: School) => ({ type: "school" as const, schoolId: s.id, name: s.name, leaid: s.leaid, lat: s.lat, lon: s.lon, district: s.district });

function RefreshButton({ loading, updatedAt, onClick }: { loading: boolean; updatedAt: number | null; onClick: () => void }) {
  return (
    <button onClick={onClick} className="neu-press ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-3 text-sm text-text-3 hover:text-text">
      <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} aria-hidden /> Updated {updatedAt ? timeAgo(new Date(updatedAt).toISOString()) : "now"}
      <span className="sr-only">, refresh prediction</span>
    </button>
  );
}

function SchoolHeader({ s, fav, refresh }: { s: School; fav: ReturnType<typeof favOf>; refresh: React.ReactNode }) {
  return (
    <section>
        <p className="text-sm text-text-3">
          {s.type === "private" ? "Private school" : s.district ?? "Public school"}
          {s.locale && LOCALE_LABELS[s.locale] ? `, ${LOCALE_LABELS[s.locale].toLowerCase()}` : ""}
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">{s.name}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-text-2">
          <MapPin className="size-4 text-text-3" aria-hidden />
          {[s.street, s.city].filter(Boolean).join(", ")}, {s.state} {s.zip}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FavoriteButton item={fav} />
          <ShareButton title={`${s.name}: snow day odds`} />
          <Link href={`/forecast/${encodeSlug({ name: `${s.city ?? s.name}, ${s.state}`, lat: s.lat, lon: s.lon })}`} className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-semibold text-ice underline-offset-4 hover:underline">
            Full snowfall forecast
          </Link>
          {refresh}
        </div>
    </section>
  );
}
