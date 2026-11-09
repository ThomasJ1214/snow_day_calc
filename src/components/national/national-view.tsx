"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { NationalSummary } from "@/lib/national/summary";
import { Panel, PanelTitle, Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/client/use-api";
import { fmtDay, fmtIn, timeAgo } from "@/lib/client/format";
import { encodeSlug } from "@/lib/geo/slug";

const SnowMap = dynamic(() => import("@/components/map/snow-map").then((m) => m.SnowMap), { ssr: false, loading: () => <Skeleton className="h-[560px]" /> });

interface Elevated {
  schools: { id: string; name: string; city: string; district: string | null; closurePct: number; delayPct: number; targetDay: string }[];
  checkedCities?: string[];
}

export function NationalView() {
  const { data, error } = useApi<NationalSummary>("/api/national/summary", 30 * 60_000);
  const elevated = useApi<Elevated>("/api/national/elevated", 30 * 60_000);
  const ranked = data ? [...data.cities].sort((a, b) => (b.total72Cm ?? -1) - (a.total72Cm ?? -1)) : [];
  const significant = ranked.filter((c) => (c.total72Cm ?? 0) >= 10.16);
  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Snow across the U.S.</h1>
        <p className="mt-2 max-w-2xl text-text-2">
          HRRR snowfall decoded from NOAA&apos;s raw model files, NOAA Weather Prediction Center odds of 4″ or more, and current snow cover. Click anywhere on the map for
          that spot&apos;s forecast.
        </p>
      </section>
      <SnowMap cities={data?.cities ?? []} />
      {error && <p className="text-sm text-text-3">City totals are temporarily unavailable: {error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelTitle aside={data ? `Updated ${timeAgo(data.generatedAt)}` : undefined}>Regions, next 3 days</PanelTitle>
          {!data ? (
            <Skeleton className="h-48" />
          ) : (
            <table className="w-full text-sm tabular">
              <thead className="text-left text-text-3">
                <tr>
                  <th className="py-1.5 font-medium">Region</th>
                  <th className="py-1.5 font-medium">Snowiest city</th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                  <th className="py-1.5 text-right font-medium">Cities with 1″+</th>
                </tr>
              </thead>
              <tbody>
                {[...data.regions].sort((a, b) => b.maxCm - a.maxCm).map((r) => (
                  <tr key={r.region} className="border-t border-line">
                    <td className="py-2 font-medium">{r.region}</td>
                    <td className="py-2 text-text-2">{r.leader ?? "No snow expected"}</td>
                    <td className="py-2 text-right font-display text-base font-semibold">{fmtIn(r.maxCm)}</td>
                    <td className="py-2 text-right text-text-2">{r.snowyCities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data && <p className="mt-3 text-xs text-text-3">City totals: {data.model}, summed by local calendar day (today through the day after tomorrow).</p>}
        </Panel>
        <Panel>
          <PanelTitle>Significant snow (4″+)</PanelTitle>
          {!data ? (
            <Skeleton className="h-40" />
          ) : significant.length === 0 ? (
            <p className="text-sm text-text-2">No reference city expects 4″ or more in the next three days.</p>
          ) : (
            <ul className="divide-y divide-line">
              {significant.map((c) => (
                <li key={`${c.name}${c.state}`}>
                  <Link className="flex justify-between py-2 text-sm hover:text-ice" href={`/forecast/${encodeSlug({ name: `${c.name}, ${c.state}`, lat: c.lat, lon: c.lon })}`}>
                    <span>
                      {c.name}, {c.state}
                    </span>
                    <span className="font-display font-semibold tabular">{fmtIn(c.total72Cm)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelTitle>Schools with elevated closure odds</PanelTitle>
          {!elevated.data && !elevated.error && <Skeleton className="h-40" />}
          {elevated.data && elevated.data.schools.length === 0 && (
            <p className="text-sm text-text-2">
              No schools near the snowiest reference cities currently have a meaningful chance of closing or delaying.
              {elevated.data.checkedCities?.length ? ` Checked near ${elevated.data.checkedCities.join(", ")}.` : ""}
            </p>
          )}
          <ul className="divide-y divide-line">
            {elevated.data?.schools.map((s) => (
              <li key={s.id}>
                <Link href={`/school/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-ice">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate text-text-3">
                      {s.city}, {s.targetDay}
                    </span>
                  </span>
                  <span className="shrink-0 tabular">
                    <span className="font-display text-lg font-bold text-rose">{s.closurePct}%</span> <span className="text-text-3">close</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelTitle>All reference cities</PanelTitle>
          {!data ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm tabular">
                <thead className="sticky top-0 bg-bg-2 text-left text-text-3">
                  <tr>
                    <th className="py-1.5 font-medium">City</th>
                    {data.cities[0]?.daysCm.map((_, i) => (
                      <th key={i} className="py-1.5 text-right font-medium">
                        {i === 0 ? "Today" : fmtDay(new Date(Date.parse(data.generatedAt) + i * 86_400_000).toISOString().slice(0, 10), { weekday: "short" })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((c) => (
                    <tr key={`${c.name}${c.state}`} className="border-t border-line">
                      <td className="py-1.5">
                        <Link className="hover:text-ice" href={`/forecast/${encodeSlug({ name: `${c.name}, ${c.state}`, lat: c.lat, lon: c.lon })}`}>
                          {c.name}, {c.state}
                        </Link>
                      </td>
                      {c.daysCm.map((d, i) => (
                        <td key={i} className="py-1.5 text-right text-text-2">
                          {fmtIn(d)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
