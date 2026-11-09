"use client";
import Link from "next/link";
import type { SchoolPrediction } from "@/components/forecast/types";
import { SnowStake } from "@/components/forecast/snow-stake";
import { Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/client/use-api";
import { fmtIn } from "@/lib/client/format";

const MTHS = "pub-341065004332";
const STATUS: Record<string, string> = {
  officially_closed: "Officially closed",
  officially_delayed: "Officially delayed",
  no_cancellation_announced: "No closure announced",
  prediction_only: "No decision posted yet",
  unavailable: "Official status unavailable",
};

/** Live Montville, NJ snapshot (the primary audience): snow stake, school odds, official status. */
export function MontvilleCard() {
  const { data: p, error } = useApi<SchoolPrediction>(`/api/school-forecast/${MTHS}`, 10 * 60_000);
  if (error) return <p className="glass rounded-3xl p-6 text-sm text-text-2">Montville&apos;s live forecast is temporarily unavailable.</p>;
  if (!p) return <Skeleton className="h-[340px] w-full" />;
  const w = p.forecast.snow.windows["72"];
  return (
    <article className="glass-strong relative overflow-hidden rounded-[2rem] p-6">
      <div className="flex gap-6">
        <div className="w-28 shrink-0 sm:w-36">
          <SnowStake lowCm={w.low} likelyCm={w.likely} highCm={w.high} height={250} title="Montville snow in the next 72 hours" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">Montville, NJ right now</h2>
          <p className="mt-3 text-sm text-text-2">Next 72 hours</p>
          <p className="font-display text-5xl font-extrabold leading-none tabular">{fmtIn(w.likely)}</p>
          <p className="mt-1 text-sm text-text-3 tabular">{w.high === 0 ? "No snow expected" : `${fmtIn(w.low)} to ${fmtIn(w.high)}`}</p>
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm text-text-2">Montville Township High School, {p.targetDayLabel.split(",")[0]}</p>
            {p.prediction ? (
              <p className="mt-1 text-lg tabular">
                <span className="font-display text-2xl font-bold text-rose">{p.prediction.closurePct}%</span> closed{" "}
                <span className="ml-2 font-display text-2xl font-bold text-amber">{p.prediction.delayPct}%</span> delayed
              </p>
            ) : (
              <p className="mt-1 text-text-2">Not yet in forecast range</p>
            )}
            <p className="mt-1 text-sm text-text-3">{STATUS[p.official.status]} on montville.net</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
            <Link href={`/school/${MTHS}`} className="text-ice hover:underline">
              Montville schools
            </Link>
            <Link href="/forecast/montville-nj--40.9154_-74.3638" className="text-ice hover:underline">
              Hour-by-hour snow
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
