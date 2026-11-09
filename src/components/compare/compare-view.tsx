"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, X } from "lucide-react";
import type { LocationForecast } from "@/components/forecast/types";
import { decodeSlug, encodeSlug } from "@/lib/geo/slug";
import { useFavorites } from "@/lib/client/storage";
import { CM_PER_IN, fmtIn, fmtLocal } from "@/lib/client/format";
import { Notice, Panel, PanelTitle, Skeleton } from "@/components/ui/primitives";

const COLORS = ["var(--text)", "var(--ice)", "var(--violet)", "var(--rose)"];
const DASH = ["", "6 4", "2 3", "10 3 2 3"];

export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const { favorites } = useFavorites();
  const slugParam = params.get("l") ?? "";
  const slugs = useMemo(() => slugParam.split(",").filter(Boolean).slice(0, 4), [slugParam]);
  const places = useMemo(() => slugs.map(decodeSlug).filter((p): p is NonNullable<typeof p> => p != null), [slugs]);
  const [data, setData] = useState<Record<string, LocationForecast | "error">>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ name: string; lat: number; lon: number }[]>([]);

  const setSlugs = (list: string[]) => router.replace(`/compare?l=${list.join(",")}`);
  useEffect(() => {
    for (const p of places) {
      const key = encodeSlug(p);
      if (data[key]) continue;
      fetch(`/api/forecast?lat=${p.lat}&lon=${p.lon}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((f) => setData((d) => ({ ...d, [key]: f })))
        .catch(() => setData((d) => ({ ...d, [key]: "error" })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => setResults(d.results.slice(0, 5)));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const chart = useMemo(() => {
    const ready = places.map((p) => ({ p, f: data[encodeSlug(p)] })).filter((x): x is { p: (typeof places)[0]; f: LocationForecast } => !!x.f && x.f !== "error");
    if (!ready.length) return [];
    const len = Math.min(...ready.map((x) => x.f.snow.hourly.filter((h) => !h.past).length));
    return Array.from({ length: len }, (_, i) => {
      const row: Record<string, number | string | null> = { t: ready[0].f.snow.hourly.filter((h) => !h.past)[i].time };
      for (const { p, f } of ready) {
        const h = f.snow.hourly.filter((x) => !x.past)[i];
        row[p.name] = h.cumLikely == null ? null : +(h.cumLikely / CM_PER_IN).toFixed(2);
      }
      return row;
    });
  }, [data, places]);

  const add = (p: { name: string; lat: number; lon: number }) => {
    const s = encodeSlug(p);
    if (!slugs.includes(s) && slugs.length < 4) setSlugs([...slugs, s]);
    setQ("");
    setResults([]);
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Compare locations</h1>
        <p className="mt-2 text-text-2">Up to four places side by side. Times on the chart are local to the first place.</p>
      </section>
      <Panel>
        <div className="flex flex-wrap gap-2">
          {places.map((p, i) => (
            <span key={encodeSlug(p)} className="neu-raised-sm inline-flex min-h-11 items-center gap-2 rounded-2xl py-1 pl-3.5 pr-1 text-sm font-medium">
              <span className="size-2.5 rounded-full" style={{ background: COLORS[i] }} aria-hidden />
              {p.name}
              <button aria-label={`Remove ${p.name}`} onClick={() => setSlugs(slugs.filter((s) => s !== encodeSlug(p)))} className="neu-press grid size-9 cursor-pointer place-items-center rounded-xl">
                <X className="size-4" />
              </button>
            </span>
          ))}
        </div>
        {slugs.length < 4 && (
          <div className="relative mt-4 max-w-md">
            <label htmlFor="cmp" className="sr-only">
              Add a place
            </label>
            <input id="cmp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a ZIP code or city" className="neu-field h-12 w-full rounded-2xl px-4 focus:outline-none" />
            {q.trim().length >= 2 && results.length > 0 && (
              <ul className="neu-raised-lg absolute inset-x-0 top-full z-20 mt-3 rounded-[20px] p-2">
                {results.map((r) => (
                  <li key={`${r.lat},${r.lon}`}>
                    <button onClick={() => add(r)} className="neu-press flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm">
                      <Plus className="size-4 text-ice" aria-hidden /> {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {favorites.some((f) => f.type === "location") && slugs.length < 4 && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="text-text-3">From your saved places:</span>
            {favorites
              .filter((f) => f.type === "location")
              .map((f) => (
                <button key={f.name} onClick={() => add(f)} className="cursor-pointer text-ice underline-offset-4 hover:underline">
                  {f.name}
                </button>
              ))}
          </div>
        )}
      </Panel>

      {places.length === 0 ? (
        <Notice title="Add two or more places to compare">
          Try{" "}
          <Link className="text-ice underline" href={`/compare?l=${encodeSlug({ name: "Montville, NJ", lat: 40.9154, lon: -74.3638 })},${encodeSlug({ name: "Morristown, NJ", lat: 40.7968, lon: -74.4815 })}`}>
            Montville and Morristown
          </Link>
          .
        </Notice>
      ) : (
        <>
          <Panel>
            <PanelTitle>Most likely accumulation</PanelTitle>
            {chart.length === 0 ? (
              <Skeleton className="h-72" />
            ) : (
              <div className="h-72" role="img" aria-label="Most likely snow accumulation for each place">
                <ResponsiveContainer>
                  <LineChart data={chart} margin={{ left: -12, right: 8 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="t" interval={11} tickFormatter={(t: string) => fmtLocal(t, { weekday: "short", hour: "numeric" })} tick={{ fill: "var(--text-3)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-3)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}″`} width={44} />
                    <Tooltip contentStyle={{ background: "var(--bg)", border: "none", borderRadius: 14, boxShadow: "6px 6px 14px var(--sh-dark), -6px -6px 14px var(--sh-light)" }} labelFormatter={(t) => fmtLocal(String(t))} formatter={(v) => `${v}″`} />
                    <Legend wrapperStyle={{ color: "var(--text-2)" }} />
                    {places.map((p, i) => (
                      <Line key={p.name} dataKey={p.name} stroke={COLORS[i]} strokeDasharray={DASH[i]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
          <div className="overflow-x-auto">
            <table className="neu-raised w-full min-w-[560px] rounded-[26px] text-sm tabular">
              <thead className="text-left text-text-3">
                <tr>
                  <th className="p-3 font-medium">Place</th>
                  {["12", "24", "48", "72"].map((k) => (
                    <th key={k} className="p-3 font-medium">
                      Next {k} h
                    </th>
                  ))}
                  <th className="p-3 font-medium">Chance of 0.1″+</th>
                  <th className="p-3 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {places.map((p) => {
                  const f = data[encodeSlug(p)];
                  return (
                    <tr key={p.name} className="border-t border-line">
                      <th className="p-3 text-left font-medium">
                        <Link className="hover:text-ice" href={`/forecast/${encodeSlug(p)}`}>
                          {p.name}
                        </Link>
                      </th>
                      {f === "error" ? (
                        <td colSpan={6} className="p-3 text-text-3">
                          Forecast unavailable
                        </td>
                      ) : !f ? (
                        <td colSpan={6} className="p-3">
                          <Skeleton className="h-5" />
                        </td>
                      ) : (
                        <>
                          {(["12", "24", "48", "72"] as const).map((k) => (
                            <td key={k} className="p-3">
                              <span className="font-display text-base font-semibold">{fmtIn(f.snow.windows[k].likely)}</span>
                              <span className="ml-1 text-text-3">
                                {fmtIn(f.snow.windows[k].low)}–{fmtIn(f.snow.windows[k].high)}
                              </span>
                            </td>
                          ))}
                          <td className="p-3">{f.snow.pMeasurable == null ? "—" : `${Math.round(f.snow.pMeasurable * 100)}%`}</td>
                          <td className="p-3">{f.snow.confidence.label}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
