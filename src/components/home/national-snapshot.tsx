"use client";
import Link from "next/link";
import type { NationalSummary } from "@/lib/national/summary";
import { encodeSlug } from "@/lib/geo/slug";
import { Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/client/use-api";
import { fmtIn } from "@/lib/client/format";

export function NationalSnapshot() {
  const { data, error } = useApi<NationalSummary>("/api/national/summary", 30 * 60_000);
  if (error) return <p className="text-sm text-text-3">National conditions are temporarily unavailable.</p>;
  if (!data) return <Skeleton className="h-48" />;
  const snowy = [...data.cities].filter((c) => (c.total72Cm ?? 0) >= 0.25).sort((a, b) => (b.total72Cm ?? 0) - (a.total72Cm ?? 0));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Across the country</h2>
        <p className="mt-2 max-w-md text-text-2">
          {snowy.length
            ? `${snowy.length} of ${data.cities.length} reference cities expect measurable snow in the next three days.`
            : `None of the ${data.cities.length} reference cities expects measurable snow in the next three days.`}
        </p>
        <Link href="/national" className="neu-raised-sm neu-press mt-5 inline-flex min-h-11 items-center rounded-2xl bg-accent! px-5 text-sm font-semibold text-on-accent hover:brightness-110">
          Open the national map
        </Link>
      </div>
      <ol className="divide-y divide-line">
        {(snowy.length ? snowy : data.cities.filter((c) => c.featured)).slice(0, 6).map((c) => (
          <li key={`${c.name}${c.state}`}>
            <Link href={`/forecast/${encodeSlug({ name: `${c.name}, ${c.state}`, lat: c.lat, lon: c.lon })}`} className="flex items-center justify-between py-3 hover:text-ice">
              <span className="font-medium">
                {c.name}, {c.state} <span className="text-sm text-text-3">{c.region}</span>
              </span>
              <span className="font-display text-xl font-semibold tabular">{fmtIn(c.total72Cm)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
